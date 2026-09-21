from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import migrations


TOPICS = [
    ("Поступление на бакалавриат", "Привлечь абитуриентов на программы бакалавриата."),
    ("Поступление в магистратуру", "Рассказать выпускникам о программах магистратуры."),
    ("День открытых дверей", "Пригласить абитуриентов и родителей на встречу с университетом."),
    ("Программы колледжа", "Повысить интерес к программам среднего профессионального образования."),
    ("Информационные технологии", "Представить направления подготовки в сфере ИТ."),
    ("Экономика и управление", "Познакомить абитуриентов с экономическими программами."),
    ("Юридические программы", "Рассказать об обучении по юридическим направлениям."),
    ("Дистанционное обучение", "Показать возможности дистанционного формата обучения."),
    ("Дополнительное образование", "Привлечь слушателей на программы повышения квалификации."),
    ("Условия поступления", "Разъяснить сроки подачи документов и этапы приёма."),
]


def add_demo_campaigns(apps, schema_editor):
    user_app, user_model = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(user_app, user_model)
    UserProfile = apps.get_model("core", "UserProfile")
    Status = apps.get_model("core", "Status")
    StatusTransition = apps.get_model("core", "StatusTransition")
    Channel = apps.get_model("core", "Channel")
    MetricSource = apps.get_model("core", "MetricSource")
    MetricType = apps.get_model("core", "MetricType")
    Campaign = apps.get_model("core", "Campaign")
    Activity = apps.get_model("core", "Activity")
    MetricValue = apps.get_model("core", "MetricValue")
    Report = apps.get_model("core", "Report")

    manager, _ = User.objects.get_or_create(
        username="demo_marketing",
        defaults={
            "first_name": "Мария",
            "last_name": "Соколова",
            "email": "",
            "password": make_password(None),
            "is_active": True,
        },
    )
    UserProfile.objects.get_or_create(user_id=manager.pk, defaults={"role": "manager"})

    campaign_status = {
        name: Status.objects.get_or_create(name=name, entity_type="campaign")[0]
        for name in ("Черновик", "Активна", "Завершена", "Отменена")
    }
    activity_status = {
        name: Status.objects.get_or_create(name=name, entity_type="activity")[0]
        for name in ("Запланирована", "В работе", "Выполнена", "Отменена")
    }

    for statuses, pairs in (
        (campaign_status, (("Черновик", "Активна"), ("Черновик", "Отменена"), ("Активна", "Завершена"), ("Активна", "Отменена"))),
        (activity_status, (("Запланирована", "В работе"), ("Запланирована", "Отменена"), ("В работе", "Выполнена"), ("В работе", "Отменена"))),
    ):
        for from_name, to_name in pairs:
            StatusTransition.objects.get_or_create(
                from_status_id=statuses[from_name].pk,
                to_status_id=statuses[to_name].pk,
            )

    channels = {
        name: Channel.objects.get_or_create(name=name, defaults={"url": url})[0]
        for name, url in (
            ("ВКонтакте", "https://vk.com/"),
            ("Telegram", "https://t.me/"),
            ("Официальный сайт", "https://muiv.ru/"),
        )
    }
    source, _ = MetricSource.objects.get_or_create(
        name="Ручной ввод",
        type="MANUAL",
        defaults={"is_active": True},
    )
    metric_types = {
        name: MetricType.objects.get_or_create(name=name, defaults={"unit": unit})[0]
        for name, unit in (("Просмотры", "шт."), ("Переходы", "шт."), ("Заявки", "шт."))
    }

    today = date.today()
    for year_offset in (0, 1):
        year = today.year + year_offset
        for index, (topic, goal) in enumerate(TOPICS):
            if year_offset:
                state = "Черновик"
                start = date(year, 2 + index % 4, 1)
                end = start + timedelta(days=60)
            elif index < 3:
                state = "Завершена"
                start = today - timedelta(days=100 + index * 5)
                end = today - timedelta(days=10 + index)
            else:
                state = "Активна"
                start = today - timedelta(days=15 + index)
                end = today + timedelta(days=45 + index)

            campaign, _ = Campaign.objects.get_or_create(
                name=f"{topic} — {year}",
                defaults={
                    "responsible_user_id": manager.pk,
                    "goal": goal,
                    "budget": Decimal(60000 + index * 18000 + year_offset * 12000),
                    "start_date": start,
                    "end_date": end,
                    "status_id": campaign_status[state].pk,
                },
            )

            activity_state = {
                "Черновик": "Запланирована",
                "Активна": "В работе",
                "Завершена": "Выполнена",
            }[state]
            activities = (
                (f"Публикации во ВКонтакте: {topic}", "ВКонтакте", "Серия публикаций для абитуриентов в сообществе университета."),
                (f"Анонсы в Telegram: {topic}", "Telegram", "Анонсы сроков поступления и образовательных программ."),
                (f"Материалы на сайте: {topic}", "Официальный сайт", "Информационные материалы на сайте университета."),
            )
            for activity_index, (activity_name, channel_name, description) in enumerate(activities):
                activity, _ = Activity.objects.get_or_create(
                    campaign_id=campaign.pk,
                    name=activity_name,
                    defaults={
                        "channel_id": channels[channel_name].pk,
                        "metric_source_id": source.pk,
                        "description": description,
                        "status_id": activity_status[activity_state].pk,
                    },
                )
                plans = {
                    "Просмотры": 6000 + index * 500 + activity_index * 900,
                    "Переходы": 420 + index * 35 + activity_index * 60,
                    "Заявки": 45 + index * 4 + activity_index * 6,
                }
                for metric_name, planned in plans.items():
                    if state == "Черновик":
                        actual = 0
                    elif state == "Завершена":
                        actual = round(planned * (0.84 + (index % 3) * 0.06))
                    else:
                        actual = round(planned * (0.38 + (index % 4) * 0.08))
                    MetricValue.objects.get_or_create(
                        activity_id=activity.pk,
                        metric_type_id=metric_types[metric_name].pk,
                        defaults={
                            "planned_value": Decimal(planned),
                            "actual_value": Decimal(actual),
                        },
                    )

            if state == "Завершена" and not Report.objects.filter(campaign_id=campaign.pk).exists():
                report = Report.objects.create(campaign_id=campaign.pk)
                report.file_path = f"/api/reports/{report.pk}/xlsx/"
                report.save(update_fields=["file_path"])


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_statustransition"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(add_demo_campaigns, migrations.RunPython.noop),
    ]
