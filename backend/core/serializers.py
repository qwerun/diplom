from django.contrib.auth.models import User
from rest_framework import serializers

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


DEFAULT_CAMPAIGN_STATUS = "Черновик"
DEFAULT_ACTIVITY_STATUS = "Запланирована"
CLOSED_CAMPAIGN_STATUSES = {"Завершена", "Отменена"}
CLOSED_ACTIVITY_STATUSES = {"Выполнена", "Отменена"}


def default_status(entity_type, preferred_name):
    """Возвращает статус по умолчанию для создания сущности без выбора статуса на фронте."""
    status = Status.objects.filter(entity_type=entity_type, name=preferred_name).first()
    fallback = status or Status.objects.filter(entity_type=entity_type).first()
    if not fallback:
        raise serializers.ValidationError("Сначала добавьте стартовый статус в справочник.")
    return fallback


class UserProfileSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = UserProfile
        fields = ["role", "role_display"]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)
    password = serializers.CharField(write_only=True, required=False)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "password", "first_name", "last_name", "full_name", "email", "profile"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def create(self, validated_data):
        profile_data = validated_data.pop("profile", {})
        password = validated_data.pop("password", "12345678")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        UserProfile.objects.create(user=user, **profile_data)
        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", None)
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        if profile_data is not None:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            profile.role = profile_data.get("role", profile.role)
            profile.save()
        return instance


class StatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Status
        fields = "__all__"


class StatusTransitionSerializer(serializers.ModelSerializer):
    from_status_name = serializers.CharField(source="from_status.name", read_only=True)
    to_status_name = serializers.CharField(source="to_status.name", read_only=True)
    entity_type = serializers.CharField(source="from_status.entity_type", read_only=True)

    class Meta:
        model = StatusTransition
        fields = ["id", "from_status", "from_status_name", "to_status", "to_status_name", "entity_type"]

    def validate(self, attrs):
        from_status = attrs.get("from_status", getattr(self.instance, "from_status", None))
        to_status = attrs.get("to_status", getattr(self.instance, "to_status", None))
        if from_status and to_status:
            if from_status == to_status:
                raise serializers.ValidationError("Статус не может переходить сам в себя.")
            if from_status.entity_type != to_status.entity_type:
                raise serializers.ValidationError("Переход можно настроить только внутри одной сущности.")
        return attrs


class ChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = "__all__"


class MetricSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetricSource
        fields = "__all__"


class CampaignSerializer(serializers.ModelSerializer):
    responsible_user_name = serializers.CharField(
        source="responsible_user.get_full_name", read_only=True
    )
    status_name = serializers.CharField(source="status.name", read_only=True)

    class Meta:
        model = Campaign
        fields = "__all__"
        extra_kwargs = {
            # Статус не показываем в форме создания: backend сам ставит стартовый статус.
            "status": {"required": False},
        }

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        budget = attrs.get("budget", getattr(self.instance, "budget", 0))
        new_status = attrs.get("status")
        if budget < 0:
            raise serializers.ValidationError("Бюджет не может быть отрицательным.")
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError("Дата окончания не может быть раньше даты начала.")
        if new_status and new_status.entity_type != Status.ENTITY_CAMPAIGN:
            raise serializers.ValidationError("Для кампании выбран неподходящий тип статуса.")
        if self.instance and new_status and new_status != self.instance.status:
            exists = StatusTransition.objects.filter(
                from_status=self.instance.status,
                to_status=new_status,
            ).exists()
            if not exists:
                raise serializers.ValidationError("Такой переход статуса для кампании не настроен.")
        return attrs

    def create(self, validated_data):
        # Временный учебный комментарий: статус задается на backend, чтобы нельзя было
        # создать кампанию сразу активной простым изменением запроса из браузера.
        validated_data.setdefault(
            "status",
            default_status(Status.ENTITY_CAMPAIGN, DEFAULT_CAMPAIGN_STATUS),
        )
        return super().create(validated_data)


class ActivitySerializer(serializers.ModelSerializer):
    campaign_name = serializers.CharField(source="campaign.name", read_only=True)
    channel_name = serializers.CharField(source="channel.name", read_only=True)
    status_name = serializers.CharField(source="status.name", read_only=True)
    metric_source_name = serializers.CharField(source="metric_source.name", read_only=True)
    metric_source_type = serializers.CharField(source="metric_source.type", read_only=True)
    metric_source_type_display = serializers.CharField(source="metric_source.get_type_display", read_only=True)

    class Meta:
        model = Activity
        fields = "__all__"
        extra_kwargs = {
            # Как и у кампании, стартовый статус активности задается сервером.
            "status": {"required": False},
        }

    def validate(self, attrs):
        campaign = attrs.get("campaign", getattr(self.instance, "campaign", None))
        channel = attrs.get("channel")
        metric_source = attrs.get("metric_source")
        new_status = attrs.get("status")

        if campaign and campaign.status.name in CLOSED_CAMPAIGN_STATUSES:
            raise serializers.ValidationError("В завершенную или отмененную кампанию нельзя добавлять и менять активности.")
        if new_status and new_status.entity_type != Status.ENTITY_ACTIVITY:
            raise serializers.ValidationError("Для активности выбран неподходящий тип статуса.")
        if self.instance and new_status and new_status != self.instance.status:
            exists = StatusTransition.objects.filter(
                from_status=self.instance.status,
                to_status=new_status,
            ).exists()
            if not exists:
                raise serializers.ValidationError("Такой переход статуса для активности не настроен.")
        if self.instance and self.instance.status.name == "В работе":
            if channel and channel != self.instance.channel:
                raise serializers.ValidationError("У активности в работе нельзя менять канал.")
            if metric_source and metric_source != self.instance.metric_source:
                raise serializers.ValidationError("У активности в работе нельзя менять источник метрик.")
        if self.instance and self.instance.status.name in CLOSED_ACTIVITY_STATUSES:
            edited_fields = set(attrs.keys()) - {"status"}
            if edited_fields:
                raise serializers.ValidationError("Закрытую активность нельзя редактировать, кроме смены статуса по переходам.")
        return attrs

    def create(self, validated_data):
        validated_data.setdefault(
            "status",
            default_status(Status.ENTITY_ACTIVITY, DEFAULT_ACTIVITY_STATUS),
        )
        return super().create(validated_data)


class ActivityResultSerializer(serializers.ModelSerializer):
    activity_name = serializers.CharField(source="activity.name", read_only=True)

    class Meta:
        model = ActivityResult
        fields = "__all__"

    def validate(self, attrs):
        activity = attrs.get("activity", getattr(self.instance, "activity", None))
        if activity and activity.status.name == "Отменена":
            raise serializers.ValidationError("Для отмененной активности нельзя менять результат.")
        return attrs


class ActivityMediaSerializer(serializers.ModelSerializer):
    activity_name = serializers.CharField(source="activity.name", read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ActivityMedia
        fields = ["id", "activity", "activity_name", "title", "file", "file_url", "uploaded_at"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if request and obj.file:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else ""

    def validate(self, attrs):
        activity = attrs.get("activity", getattr(self.instance, "activity", None))
        if activity and activity.status.name == "Отменена":
            raise serializers.ValidationError("К отмененной активности нельзя прикреплять медиафайлы.")
        return attrs

    def validate_file(self, value):
        # Временный учебный комментарий: фронт тоже принимает только image/*,
        # но окончательная проверка типа файла обязательно остается на backend.
        content_type = getattr(value, "content_type", "")
        if content_type and not content_type.startswith("image/"):
            raise serializers.ValidationError("Можно загружать только изображения.")
        return value


class MetricTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetricType
        fields = "__all__"


class MetricValueSerializer(serializers.ModelSerializer):
    activity_name = serializers.CharField(source="activity.name", read_only=True)
    metric_type_name = serializers.CharField(source="metric_type.name", read_only=True)
    unit = serializers.CharField(source="metric_type.unit", read_only=True)
    completion_percent = serializers.FloatField(read_only=True)

    class Meta:
        model = MetricValue
        fields = "__all__"

    def validate(self, attrs):
        activity = attrs.get("activity", getattr(self.instance, "activity", None))
        planned = attrs.get("planned_value", getattr(self.instance, "planned_value", 0))
        actual = attrs.get("actual_value", getattr(self.instance, "actual_value", 0))
        if activity and activity.status.name == "Отменена":
            raise serializers.ValidationError("Для отмененной активности нельзя менять метрики.")
        if planned < 0 or actual < 0:
            raise serializers.ValidationError("Значения метрик не могут быть отрицательными.")
        return attrs


class ReportSerializer(serializers.ModelSerializer):
    campaign_name = serializers.CharField(source="campaign.name", read_only=True)

    class Meta:
        model = Report
        fields = "__all__"
