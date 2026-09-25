from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models


class UserProfile(models.Model):
    ROLE_ADMIN = "admin"
    ROLE_MANAGER = "manager"
    ROLE_EXECUTOR = "executor"
    ROLE_HEAD = "head"

    ROLE_CHOICES = [
        (ROLE_ADMIN, "Администратор"),
        (ROLE_MANAGER, "Менеджер"),
        (ROLE_EXECUTOR, "Исполнитель"),
        (ROLE_HEAD, "Руководитель"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_MANAGER)

    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"


class Status(models.Model):
    ENTITY_CAMPAIGN = "campaign"
    ENTITY_ACTIVITY = "activity"

    ENTITY_CHOICES = [
        (ENTITY_CAMPAIGN, "Кампания"),
        (ENTITY_ACTIVITY, "Активность"),
    ]

    name = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=20, choices=ENTITY_CHOICES)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["name", "entity_type"], name="unique_status_for_entity"
            )
        ]
        ordering = ["entity_type", "name"]

    def __str__(self):
        return f"{self.name} ({self.entity_type})"


class StatusTransition(models.Model):
    from_status = models.ForeignKey(
        Status, on_delete=models.CASCADE, related_name="outgoing_transitions"
    )
    to_status = models.ForeignKey(
        Status, on_delete=models.CASCADE, related_name="incoming_transitions"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["from_status", "to_status"], name="unique_status_transition"
            )
        ]
        ordering = ["from_status__entity_type", "from_status__name", "to_status__name"]

    def clean(self):
        if self.from_status_id and self.to_status_id:
            if self.from_status_id == self.to_status_id:
                raise ValidationError("Статус не может переходить сам в себя.")
            if self.from_status.entity_type != self.to_status.entity_type:
                raise ValidationError("Переход можно настроить только внутри одной сущности.")

    def __str__(self):
        return f"{self.from_status.name} -> {self.to_status.name}"


class Channel(models.Model):
    name = models.CharField(max_length=120, unique=True)
    url = models.URLField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class MetricSource(models.Model):
    TYPE_API = "API"
    TYPE_MANUAL = "MANUAL"
    TYPE_IMPORT = "IMPORT"

    TYPE_CHOICES = [
        (TYPE_API, "API"),
        (TYPE_MANUAL, "Ручной ввод"),
        (TYPE_IMPORT, "Импорт"),
    ]

    name = models.CharField(max_length=120)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_MANUAL)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} / {self.type}"


class Campaign(models.Model):
    responsible_user = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="campaigns"
    )
    name = models.CharField(max_length=200)
    goal = models.TextField()
    budget = models.DecimalField(max_digits=12, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.ForeignKey(
        Status,
        on_delete=models.PROTECT,
        limit_choices_to={"entity_type": Status.ENTITY_CAMPAIGN},
        related_name="campaigns",
    )

    class Meta:
        ordering = ["-start_date", "name"]

    def clean(self):
        if self.budget < 0:
            raise ValidationError("Бюджет не может быть отрицательным.")
        if self.end_date < self.start_date:
            raise ValidationError("Дата окончания не может быть раньше даты начала.")

    def __str__(self):
        return self.name


class Activity(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="activities")
    channel = models.ForeignKey(Channel, on_delete=models.PROTECT, related_name="activities")
    metric_source = models.ForeignKey(
        MetricSource, on_delete=models.PROTECT, related_name="activities"
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.ForeignKey(
        Status,
        on_delete=models.PROTECT,
        limit_choices_to={"entity_type": Status.ENTITY_ACTIVITY},
        related_name="activities",
    )

    class Meta:
        ordering = ["campaign", "name"]

    def __str__(self):
        return self.name


class ActivityResult(models.Model):
    activity = models.OneToOneField(
        Activity, on_delete=models.CASCADE, related_name="result"
    )
    result_url = models.URLField(blank=True)
    comment = models.TextField(blank=True)

    def __str__(self):
        return f"Результат: {self.activity.name}"


class ActivityMedia(models.Model):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name="media_files")
    file = models.FileField(upload_to="activity_media/")
    title = models.CharField(max_length=160, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return self.title or self.file.name


class MetricType(models.Model):
    name = models.CharField(max_length=120, unique=True)
    unit = models.CharField(max_length=40)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name}, {self.unit}"


class MetricValue(models.Model):
    activity = models.ForeignKey(
        Activity, on_delete=models.CASCADE, related_name="metric_values"
    )
    metric_type = models.ForeignKey(
        MetricType, on_delete=models.PROTECT, related_name="values"
    )
    planned_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    actual_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    collected_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["activity", "metric_type"], name="unique_metric_for_activity"
            )
        ]
        ordering = ["activity", "metric_type"]

    @property
    def completion_percent(self):
        if self.planned_value > 0:
            return round(float(self.actual_value / self.planned_value * 100), 1)
        return 0

    def clean(self):
        if self.planned_value < 0 or self.actual_value < 0:
            raise ValidationError("Значения метрик не могут быть отрицательными.")

    def __str__(self):
        return f"{self.activity.name}: {self.metric_type.name}"


class Report(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="reports")
    create_date = models.DateTimeField(auto_now_add=True)
    file_path = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-create_date"]

    def __str__(self):
        return f"Отчет по кампании {self.campaign.name}"
