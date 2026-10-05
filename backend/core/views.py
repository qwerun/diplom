from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Count, Q, Sum
from django.db.models.deletion import ProtectedError
import mimetypes
from pathlib import Path

from django.http import FileResponse, Http404
from decimal import Decimal
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from rest_framework import decorators, pagination, permissions, response, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from .integrations import MetricApiError, fetch_external_metrics
from .models import (
    Activity,
    ActivityMedia,
    ActivityResult,
    Campaign,
    Channel,
    MetricSource,
    MetricType,
    MetricValue,
    Report,
    Status,
    StatusTransition,
    UserProfile,
)
from .permissions import (
    CanEditActivityResult,
    CanEditMetrics,
    CanManageActivityMedia,
    CanUseReports,
    IsAdmin,
    IsAdminOrReadOnly,
    IsManagerOrReadOnly,
    IsManagerOrStatusOnly,
)
from .serializers import (
    ActivityResultSerializer,
    ActivityMediaSerializer,
    ActivitySerializer,
    CampaignSerializer,
    ChannelSerializer,
    PasswordChangeSerializer,
    UserSelfUpdateSerializer,
    MetricSourceSerializer,
    MetricTypeSerializer,
    MetricValueSerializer,
    ReportSerializer,
    StatusSerializer,
    StatusTransitionSerializer,
    UserSerializer,
)
from .permissions import user_role


class StandardResultsSetPagination(pagination.PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100

class ProtectedDeleteMixin:
    protected_delete_message = "Запись нельзя удалить, потому что она используется в других данных системы."
    protected_related_checks = []

    def get_protected_delete_message(self, instance):
        for related_name, message in self.protected_related_checks:
            related = getattr(instance, related_name, None)
            if related is not None and related.exists():
                return message
        return self.protected_delete_message

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        message = self.get_protected_delete_message(instance)
        if message != self.protected_delete_message:
            return response.Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return response.Response({"detail": self.protected_delete_message}, status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return response.Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSelfUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(UserSerializer(request.user).data)


class UserViewSet(ProtectedDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = User.objects.select_related("profile").all().order_by("username")
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    search_fields = ["username", "first_name", "last_name", "email"]
    protected_delete_message = "Пользователя нельзя удалить, потому что он связан с кампаниями или другими записями системы."
    protected_related_checks = [
        ("campaigns", "Пользователя нельзя удалить, потому что он указан ответственным за рекламные кампании."),
    ]

    def get_permissions(self):
        if self.action in {"executors", "managers"}:
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.id == request.user.id:
            return response.Response(
                {"detail": "Нельзя удалить собственную учетную запись."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @decorators.action(detail=False, methods=["get"])
    def executors(self, request):
        users = self.get_queryset().filter(profile__role=UserProfile.ROLE_EXECUTOR, is_active=True)
        return response.Response(UserSerializer(users, many=True).data)

    @decorators.action(detail=False, methods=["get"])
    def managers(self, request):
        users = self.get_queryset().filter(profile__role=UserProfile.ROLE_MANAGER, is_active=True)
        return response.Response(UserSerializer(users, many=True).data)


class StatusViewSet(ProtectedDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = Status.objects.all()
    serializer_class = StatusSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["entity_type"]
    protected_delete_message = "Статус нельзя удалить, потому что он используется в кампаниях, активностях или переходах."
    protected_related_checks = [
        ("campaigns", "Статус нельзя удалить, потому что он используется в рекламных кампаниях."),
        ("activities", "Статус нельзя удалить, потому что он используется в активностях."),
        ("outgoing_transitions", "Статус нельзя удалить, потому что для него настроены переходы."),
        ("incoming_transitions", "Статус нельзя удалить, потому что на него настроены переходы."),
    ]


class StatusTransitionViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = StatusTransition.objects.select_related("from_status", "to_status")
    serializer_class = StatusTransitionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        entity_type = self.request.query_params.get("entity_type")
        if entity_type:
            queryset = queryset.filter(from_status__entity_type=entity_type)
        return queryset


class ChannelViewSet(ProtectedDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = Channel.objects.all()
    serializer_class = ChannelSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["name"]
    protected_delete_message = "Канал нельзя удалить, потому что он используется в активностях."
    protected_related_checks = [
        ("activities", "Канал нельзя удалить, потому что он используется в активностях."),
    ]


class MetricSourceViewSet(ProtectedDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = MetricSource.objects.all()
    serializer_class = MetricSourceSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["type", "is_active"]
    protected_delete_message = "Источник метрик нельзя удалить, потому что он используется в активностях."
    protected_related_checks = [
        ("activities", "Источник метрик нельзя удалить, потому что он используется в активностях."),
    ]


class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.select_related("responsible_user", "executor", "status")
    serializer_class = CampaignSerializer
    permission_classes = [IsManagerOrStatusOnly]
    pagination_class = StandardResultsSetPagination
    filterset_fields = ["status", "responsible_user", "executor"]
    search_fields = ["name", "goal", "status__name", "responsible_user__first_name", "responsible_user__last_name", "executor__first_name", "executor__last_name"]
    ordering_fields = [
        "name",
        "status__name",
        "responsible_user__last_name",
        "executor__last_name",
        "budget",
        "start_date",
        "end_date",
    ]

    def get_queryset(self):
        queryset = super().get_queryset()
        if user_role(self.request.user) == "executor":
            return queryset.filter(executor=self.request.user)
        return queryset

    def destroy(self, request, *args, **kwargs):
        campaign = self.get_object()
        if campaign.status.is_terminal:
            return response.Response(
                {"detail": "Завершенную или отмененную кампанию нельзя удалить."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class ActivityViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = Activity.objects.select_related(
        "campaign", "channel", "metric_source", "status"
    )
    serializer_class = ActivitySerializer
    permission_classes = [IsManagerOrStatusOnly]
    filterset_fields = ["campaign", "channel", "status", "metric_source"]
    search_fields = ["name", "description"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if user_role(self.request.user) == "executor":
            return queryset.filter(campaign__executor=self.request.user)
        return queryset

    def get_permissions(self):
        if self.action == "collect_metrics":
            return [CanEditMetrics()]
        return super().get_permissions()

    @decorators.action(detail=True, methods=["post"], url_path="collect-metrics")
    def collect_metrics(self, request, pk=None):
        activity = self.get_object()
        if activity.metric_source.type != MetricSource.TYPE_API:
            return response.Response(
                {"detail": "Автосбор доступен только для источников типа API."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = getattr(activity, "result", None)
        if not result or not result.result_url:
            return response.Response(
                {"detail": "Для API-сбора сначала добавьте результат: ссылку на пост."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        metric_values = list(activity.metric_values.select_related("metric_type"))
        if not metric_values:
            return response.Response(
                {"detail": "Сначала добавьте плановые метрики активности."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            api_metrics = fetch_external_metrics(activity.metric_source, result.result_url)
        except MetricApiError as error:
            return response.Response({"detail": str(error.detail[0])}, status=status.HTTP_400_BAD_REQUEST)

        updated_names = []
        skipped_names = []
        for metric in metric_values:
            metric_name = metric.metric_type.name.strip().lower()
            if metric_name not in api_metrics:
                skipped_names.append(metric.metric_type.name)
                continue
            metric.actual_value = Decimal(api_metrics[metric_name]).quantize(Decimal("0.01"))
            metric.save(update_fields=["actual_value", "collected_at"])
            updated_names.append(metric.metric_type.name)

        if not updated_names:
            return response.Response(
                {"detail": "API не вернул ни одну из метрик, добавленных к активности."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = MetricValueSerializer(metric_values, many=True)
        return response.Response(
            {
                "detail": f"Обновлено из {activity.metric_source.name}: {', '.join(updated_names)}.",
                "skipped": skipped_names,
                "metrics": serializer.data,
            }
        )


def ensure_activity_is_not_terminal(activity, message):
    if activity and activity.status.is_terminal:
        raise ValidationError({"detail": message})


class ActivityResultViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = ActivityResult.objects.select_related("activity", "activity__campaign")
    serializer_class = ActivityResultSerializer
    permission_classes = [CanEditActivityResult]
    filterset_fields = ["activity"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if user_role(self.request.user) == "executor":
            return queryset.filter(activity__campaign__executor=self.request.user)
        return queryset

    def perform_destroy(self, instance):
        ensure_activity_is_not_terminal(
            instance.activity,
            "У закрытой активности нельзя удалять результат.",
        )
        super().perform_destroy(instance)


class ActivityMediaViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = ActivityMedia.objects.select_related("activity", "activity__campaign")
    serializer_class = ActivityMediaSerializer
    permission_classes = [CanManageActivityMedia]
    parser_classes = [MultiPartParser, FormParser]
    filterset_fields = ["activity"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if user_role(self.request.user) == "executor":
            return queryset.filter(activity__campaign__executor=self.request.user)
        return queryset

    def perform_destroy(self, instance):
        ensure_activity_is_not_terminal(
            instance.activity,
            "У закрытой активности нельзя удалять файлы.",
        )
        super().perform_destroy(instance)

    def open_media_file(self):
        media = self.get_object()
        if not media.file:
            raise Http404("File is not attached.")
        try:
            return media, media.file.open("rb")
        except FileNotFoundError as error:
            raise Http404("File is not found on server storage.") from error

    @decorators.action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        media, file_handle = self.open_media_file()
        content_type = mimetypes.guess_type(media.file.name)[0] or "application/octet-stream"
        return FileResponse(file_handle, content_type=content_type)

    @decorators.action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        media, file_handle = self.open_media_file()
        filename = media.title.strip() if media.title else Path(media.file.name).name
        if "." not in filename:
            original_extension = Path(media.file.name).suffix
            filename = f"{filename}{original_extension}"
        content_type = mimetypes.guess_type(media.file.name)[0] or "application/octet-stream"
        return FileResponse(file_handle, as_attachment=True, filename=filename, content_type=content_type)


class MetricTypeViewSet(ProtectedDeleteMixin, viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = MetricType.objects.all()
    serializer_class = MetricTypeSerializer
    permission_classes = [IsAdminOrReadOnly]
    protected_delete_message = "Тип метрики нельзя удалить, потому что по нему сохранены значения метрик."
    protected_related_checks = [
        ("values", "Тип метрики нельзя удалить, потому что по нему сохранены значения метрик."),
    ]


class MetricValueViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = MetricValue.objects.select_related("activity", "activity__campaign", "metric_type")
    serializer_class = MetricValueSerializer
    permission_classes = [CanEditMetrics]
    filterset_fields = ["activity", "metric_type"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if user_role(self.request.user) == "executor":
            return queryset.filter(activity__campaign__executor=self.request.user)
        return queryset

    def perform_destroy(self, instance):
        ensure_activity_is_not_terminal(
            instance.activity,
            "У закрытой активности нельзя удалять метрики.",
        )
        super().perform_destroy(instance)


class ReportViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = Report.objects.select_related("campaign", "generated_by").prefetch_related("campaigns")
    serializer_class = ReportSerializer
    permission_classes = [CanUseReports]
    filterset_fields = ["campaign"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if user_role(self.request.user) not in [UserProfile.ROLE_ADMIN, UserProfile.ROLE_HEAD]:
            queryset = queryset.filter(generated_by=self.request.user)
        return queryset

    def allowed_campaigns(self):
        queryset = Campaign.objects.select_related("executor", "status")
        if user_role(self.request.user) == "executor":
            queryset = queryset.filter(executor=self.request.user)
        return queryset

    @decorators.action(detail=False, methods=["post"])
    def generate(self, request):
        campaign_ids = request.data.get("campaigns")
        if campaign_ids is None:
            legacy_id = request.data.get("campaign")
            campaign_ids = [legacy_id] if legacy_id else []
        if not isinstance(campaign_ids, list):
            return response.Response(
                {"campaigns": "Передайте список идентификаторов кампаний."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        campaign_ids = [item for item in campaign_ids if item not in (None, "")]
        if not campaign_ids:
            return response.Response(
                {"campaigns": "Выберите хотя бы одну кампанию."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        campaigns = list(self.allowed_campaigns().filter(id__in=campaign_ids))
        if len(campaigns) != len(set(map(str, campaign_ids))):
            return response.Response(
                {"campaigns": "Одна или несколько кампаний недоступны."},
                status=status.HTTP_403_FORBIDDEN,
            )
        report = Report.objects.create(
            campaign=campaigns[0] if len(campaigns) == 1 else None,
            generated_by=request.user,
        )
        report.campaigns.set(campaigns)
        report.file_path = f"/api/reports/{report.id}/xlsx/"
        self.save_report_file(report, campaigns)
        report.save(update_fields=["file_path"])
        return response.Response(
            ReportSerializer(report, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def report_campaigns(self, report):
        campaigns = list(
            report.campaigns.select_related("responsible_user", "executor", "status").prefetch_related(
                "activities__channel",
                "activities__status",
                "activities__metric_source",
                "activities__metric_values__metric_type",
            )
        )
        if not campaigns and report.campaign:
            campaigns = [report.campaign]
        return campaigns

    def report_file_path(self, report):
        return Path(settings.MEDIA_ROOT) / "reports" / f"campaign_report_{report.id}.xlsx"

    def build_report_workbook(self, report, campaigns):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Сводный отчет" if len(campaigns) > 1 else "Отчет"

        title_fill = PatternFill("solid", fgColor="F2A900")
        header_fill = PatternFill("solid", fgColor="263238")
        header_font = Font(color="FFFFFF", bold=True)

        sheet["A1"] = (
            f"Сводный отчет по кампаниям: {len(campaigns)}"
            if len(campaigns) > 1
            else f"Отчет по кампании: {campaigns[0].name}"
        )
        sheet["A1"].font = Font(size=16, bold=True)
        sheet["A1"].fill = title_fill
        sheet.merge_cells("A1:J1")

        row = 3
        campaign_headers = [
            "Кампания", "Цель", "Бюджет", "Дата начала", "Дата окончания",
            "Статус", "Менеджер", "Исполнитель",
        ]
        for col, header in enumerate(campaign_headers, start=1):
            cell = sheet.cell(row=row, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
        row += 1
        for campaign in campaigns:
            values = [
                campaign.name,
                campaign.goal,
                float(campaign.budget),
                str(campaign.start_date),
                str(campaign.end_date),
                campaign.status.name,
                campaign.responsible_user.get_full_name() or campaign.responsible_user.username,
                (campaign.executor.get_full_name() or campaign.executor.username) if campaign.executor else "",
            ]
            for col, value in enumerate(values, start=1):
                sheet.cell(row=row, column=col, value=value)
            row += 1

        row += 2
        sheet.cell(row=row, column=1, value="Активности").font = Font(size=13, bold=True)
        row += 1
        activity_headers = [
            "Кампания", "Название", "Канал", "Статус", "Источник",
            "Тип сбора", "Результат", "Комментарий",
        ]
        for col, header in enumerate(activity_headers, start=1):
            cell = sheet.cell(row=row, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
        row += 1
        for campaign in campaigns:
            for activity in campaign.activities.all():
                result = getattr(activity, "result", None)
                values = [
                    campaign.name,
                    activity.name,
                    activity.channel.name,
                    activity.status.name,
                    activity.metric_source.name,
                    activity.metric_source.get_type_display(),
                    result.result_url if result else "",
                    result.comment if result else "",
                ]
                for col, value in enumerate(values, start=1):
                    sheet.cell(row=row, column=col, value=value)
                row += 1

        row += 2
        sheet.cell(row=row, column=1, value="Метрики").font = Font(size=13, bold=True)
        row += 1
        metric_headers = [
            "Кампания", "Активность", "Метрика", "Ед. изм.", "План", "Факт", "Выполнение",
        ]
        for col, header in enumerate(metric_headers, start=1):
            cell = sheet.cell(row=row, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
        row += 1
        for campaign in campaigns:
            for activity in campaign.activities.all():
                for metric in activity.metric_values.all():
                    values = [
                        campaign.name,
                        activity.name,
                        metric.metric_type.name,
                        metric.metric_type.unit,
                        float(metric.planned_value),
                        float(metric.actual_value),
                        metric.completion_percent / 100,
                    ]
                    for col, value in enumerate(values, start=1):
                        sheet.cell(row=row, column=col, value=value)
                    sheet.cell(row=row, column=7).number_format = "0.0%"
                    row += 1

        for column in "ABCDEFGHIJ":
            sheet.column_dimensions[column].width = 22
        for sheet_row in sheet.iter_rows():
            for cell in sheet_row:
                cell.alignment = Alignment(vertical="top", wrap_text=True)
        return workbook

    def save_report_file(self, report, campaigns):
        file_path = self.report_file_path(report)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        workbook = self.build_report_workbook(report, campaigns)
        workbook.save(file_path)

    @decorators.action(detail=True, methods=["get"])
    def xlsx(self, request, pk=None):
        report = self.get_object()
        file_path = self.report_file_path(report)
        filename = f"campaign_report_{report.id}.xlsx"
        content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if file_path.exists():
            return FileResponse(
                file_path.open("rb"),
                as_attachment=True,
                filename=filename,
                content_type=content_type,
            )

        campaigns = self.report_campaigns(report)
        if not campaigns:
            return response.Response(
                {"detail": "Файл отчета не найден, а связанные кампании уже недоступны."},
                status=status.HTTP_404_NOT_FOUND,
            )
        self.save_report_file(report, campaigns)
        return FileResponse(
            file_path.open("rb"),
            as_attachment=True,
            filename=filename,
            content_type=content_type,
        )

class AnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def _campaigns_for(self, request):
        queryset = Campaign.objects.all()
        if user_role(request.user) == UserProfile.ROLE_EXECUTOR:
            queryset = queryset.filter(executor=request.user)
        return queryset

    def _activities_for(self, request):
        return Activity.objects.filter(campaign__in=self._campaigns_for(request))

    def list(self, request):
        return response.Response(self.dashboard_data(request))

    @decorators.action(detail=False, methods=["get"])
    def dashboard(self, request):
        return response.Response(self.dashboard_data(request))

    @decorators.action(detail=False, methods=["get"])
    def channels(self, request):
        activities = self._activities_for(request)
        data = (
            Channel.objects.filter(activities__in=activities)
            .annotate(
                activities_count=Count("activities", filter=Q(activities__in=activities), distinct=True),
                planned=Sum("activities__metric_values__planned_value", filter=Q(activities__in=activities)),
                actual=Sum("activities__metric_values__actual_value", filter=Q(activities__in=activities)),
            )
            .values("id", "name", "activities_count", "planned", "actual")
            .order_by("name")
            .distinct()
        )
        return response.Response(list(data))

    @decorators.action(detail=False, methods=["get"], url_path="campaign/(?P<campaign_id>[^/.]+)")
    def campaign(self, request, campaign_id=None):
        if not self._campaigns_for(request).filter(pk=campaign_id).exists():
            raise Http404
        values = (
            MetricValue.objects.filter(activity__campaign_id=campaign_id)
            .values("metric_type__name")
            .annotate(planned=Sum("planned_value"), actual=Sum("actual_value"))
            .order_by("metric_type__name")
        )
        return response.Response(list(values))

    def dashboard_data(self, request):
        campaigns = self._campaigns_for(request)
        activities = self._activities_for(request)
        metrics = MetricValue.objects.filter(activity__in=activities)
        campaign_statuses = (
            Status.objects.filter(entity_type=Status.ENTITY_CAMPAIGN)
            .annotate(count=Count("campaigns", filter=Q(campaigns__in=campaigns)))
            .values("name", "count")
        )
        activity_statuses = (
            Status.objects.filter(entity_type=Status.ENTITY_ACTIVITY)
            .annotate(count=Count("activities", filter=Q(activities__in=activities)))
            .values("name", "count")
        )
        return {
            "campaigns": campaigns.count(),
            "active_campaigns": campaigns.filter(status__code="active").count(),
            "finished_campaigns": campaigns.filter(status__code="completed").count(),
            "activities": activities.count(),
            "budget_sum": campaigns.aggregate(total=Sum("budget"))["total"] or 0,
            "campaign_statuses": list(campaign_statuses),
            "activity_statuses": list(activity_statuses),
            "plan_fact": list(
                metrics.values("metric_type__name")
                .annotate(planned=Sum("planned_value"), actual=Sum("actual_value"))
                .filter(Q(planned__isnull=False) | Q(actual__isnull=False))
                .order_by("metric_type__name")
            ),
        }


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return response.Response({"detail": "Пароль изменён."})


