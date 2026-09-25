from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


STATUS_PROPERTIES = {
    ("campaign", "Черновик"): ("draft", True, False, False),
    ("campaign", "Активна"): ("active", False, False, True),
    ("campaign", "Завершена"): ("completed", False, True, True),
    ("campaign", "Отменена"): ("canceled", False, True, True),
    ("activity", "Запланирована"): ("planned", True, False, False),
    ("activity", "В работе"): ("in_progress", False, False, True),
    ("activity", "Выполнена"): ("completed", False, True, True),
    ("activity", "Отменена"): ("canceled", False, True, True),
}


def populate_statuses_and_reports(apps, schema_editor):
    Status = apps.get_model("core", "Status")
    Report = apps.get_model("core", "Report")
    for status in Status.objects.all():
        values = STATUS_PROPERTIES.get((status.entity_type, status.name))
        if values:
            status.code, status.is_initial, status.is_terminal, status.locks_fields = values
        elif not status.code:
            status.code = f"status_{status.pk}"
        status.save(update_fields=["code", "is_initial", "is_terminal", "locks_fields"])

    for report in Report.objects.exclude(campaign_id=None):
        report.campaigns.add(report.campaign_id)


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0004_demo_campaigns"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="status",
            name="code",
            field=models.SlugField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="status",
            name="is_initial",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="status",
            name="is_terminal",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="status",
            name="locks_fields",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="campaign",
            name="executor",
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={"profile__role": "executor"},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assigned_campaigns",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="report",
            name="campaign",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="legacy_reports",
                to="core.campaign",
            ),
        ),
        migrations.AddField(
            model_name="report",
            name="campaigns",
            field=models.ManyToManyField(blank=True, related_name="reports", to="core.campaign"),
        ),
        migrations.AddField(
            model_name="report",
            name="generated_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="generated_reports",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(populate_statuses_and_reports, migrations.RunPython.noop),
    ]
