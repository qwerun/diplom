from datetime import date, timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from core.models import (
    Activity,
    Campaign,
    Channel,
    MetricSource,
    MetricType,
    MetricValue,
    Status,
    StatusTransition,
    UserProfile,
)


class Command(BaseCommand):
    help = "Создает простые начальные данные для демонстрации проекта."

    def handle(self, *args, **options):
        admin = self.create_user("admin", "Администратор", "Системы", "admin@example.com", "admin")
        manager = self.create_user("manager", "Мария", "Менеджерова", "manager@example.com", "manager")
        executor = self.create_user("executor", "Иван", "Исполнитель", "executor@example.com", "executor")
        self.create_user("head", "Олег", "Руководитель", "head@example.com", "head")

        campaign_statuses = ["Черновик", "Активна", "Завершена", "Отменена"]
        activity_statuses = ["Запланирована", "В работе", "Выполнена", "Отменена"]
        for name in campaign_statuses:
            Status.objects.get_or_create(name=name, entity_type=Status.ENTITY_CAMPAIGN)
        for name in activity_statuses:
            Status.objects.get_or_create(name=name, entity_type=Status.ENTITY_ACTIVITY)

        self.create_transition("Черновик", "Активна", Status.ENTITY_CAMPAIGN)
        self.create_transition("Черновик", "Отменена", Status.ENTITY_CAMPAIGN)
        self.create_transition("Активна", "Завершена", Status.ENTITY_CAMPAIGN)
        self.create_transition("Активна", "Отменена", Status.ENTITY_CAMPAIGN)
        self.create_transition("Запланирована", "В работе", Status.ENTITY_ACTIVITY)
        self.create_transition("Запланирована", "Отменена", Status.ENTITY_ACTIVITY)
        self.create_transition("В работе", "Выполнена", Status.ENTITY_ACTIVITY)
        self.create_transition("В работе", "Отменена", Status.ENTITY_ACTIVITY)

        channels = [
            ("ВКонтакте", "https://vk.com/"),
            ("Telegram", "https://t.me/"),
            ("Официальный сайт", "https://muiv.ru/"),
            ("Email-рассылка", ""),
            ("Яндекс.Директ", "https://direct.yandex.ru/"),
        ]
        for name, url in channels:
            Channel.objects.get_or_create(name=name, defaults={"url": url})

        sources = [
            ("ВКонтакте", "API"),
            ("Telegram", "API"),
            ("Яндекс.Метрика", "API"),
            ("Ручной ввод", "MANUAL"),
        ]
        for name, source_type in sources:
            MetricSource.objects.get_or_create(name=name, type=source_type)

        metric_types = [
            ("Просмотры", "шт."),
            ("Лайки", "шт."),
            ("Комментарии", "шт."),
            ("Репосты", "шт."),
            ("Переходы", "шт."),
            ("Регистрации", "чел."),
            ("CTR", "%"),
            ("Заявки", "шт."),
        ]
        for name, unit in metric_types:
            MetricType.objects.get_or_create(name=name, defaults={"unit": unit})

        active_status = Status.objects.get(name="Активна", entity_type=Status.ENTITY_CAMPAIGN)
        planned_status = Status.objects.get(name="Запланирована", entity_type=Status.ENTITY_ACTIVITY)
        campaign, _ = Campaign.objects.get_or_create(
            name="Приемная кампания 2026",
            defaults={
                "responsible_user": manager,
                "goal": "Привлечь абитуриентов на программы бакалавриата.",
                "budget": 250000,
                "start_date": date.today(),
                "end_date": date.today() + timedelta(days=60),
                "status": active_status,
            },
        )
        activity, _ = Activity.objects.get_or_create(
            campaign=campaign,
            name="Посты в Telegram",
            defaults={
                "channel": Channel.objects.get(name="Telegram"),
                "metric_source": MetricSource.objects.get(name="Ручной ввод"),
                "description": "Серия публикаций о программах университета.",
                "status": planned_status,
            },
        )
        MetricValue.objects.get_or_create(
            activity=activity,
            metric_type=MetricType.objects.get(name="Просмотры"),
            defaults={"planned_value": 10000, "actual_value": 6200},
        )
        MetricValue.objects.get_or_create(
            activity=activity,
            metric_type=MetricType.objects.get(name="Заявки"),
            defaults={"planned_value": 120, "actual_value": 75},
        )

        self.stdout.write(self.style.SUCCESS("Seed-данные созданы. Логины: admin/manager/executor/head, пароль 12345678."))

    def create_user(self, username, first_name, last_name, email, role):
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"first_name": first_name, "last_name": last_name, "email": email},
        )
        if created:
            user.set_password("12345678")
            user.is_staff = role == "admin"
            user.is_superuser = role == "admin"
            user.save()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.save()
        return user

    def create_transition(self, from_name, to_name, entity_type):
        from_status = Status.objects.get(name=from_name, entity_type=entity_type)
        to_status = Status.objects.get(name=to_name, entity_type=entity_type)
        StatusTransition.objects.get_or_create(from_status=from_status, to_status=to_status)
