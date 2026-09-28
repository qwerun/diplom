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
        manager = self.create_user("manager", "Мария", "Соколова", "manager@example.com", "manager")
        manager_2 = self.create_user("manager2", "Анна", "Кузнецова", "manager2@example.com", "manager")
        executor = self.create_user("executor", "Иван", "Исполнитель", "executor@example.com", "executor")
        executor_2 = self.create_user("executor2", "Павел", "Орлов", "executor2@example.com", "executor")
        executor_3 = self.create_user("executor3", "Елена", "Морозова", "executor3@example.com", "executor")
        self.create_user("head", "Олег", "Руководитель", "head@example.com", "head")

        campaign_statuses = [
            {
                "name": "Черновик",
                "code": "draft",
                "entity_type": Status.ENTITY_CAMPAIGN,
                "is_initial": True,
                "is_terminal": False,
                "locks_fields": False,
            },
            {
                "name": "Активна",
                "code": "active",
                "entity_type": Status.ENTITY_CAMPAIGN,
                "is_initial": False,
                "is_terminal": False,
                "locks_fields": True,
            },
            {
                "name": "Завершена",
                "code": "completed",
                "entity_type": Status.ENTITY_CAMPAIGN,
                "is_initial": False,
                "is_terminal": True,
                "locks_fields": True,
            },
            {
                "name": "Отменена",
                "code": "canceled",
                "entity_type": Status.ENTITY_CAMPAIGN,
                "is_initial": False,
                "is_terminal": True,
                "locks_fields": True,
            },
        ]
        activity_statuses = [
            {
                "name": "Запланирована",
                "code": "planned",
                "entity_type": Status.ENTITY_ACTIVITY,
                "is_initial": True,
                "is_terminal": False,
                "locks_fields": False,
            },
            {
                "name": "В работе",
                "code": "in_progress",
                "entity_type": Status.ENTITY_ACTIVITY,
                "is_initial": False,
                "is_terminal": False,
                "locks_fields": True,
            },
            {
                "name": "Выполнена",
                "code": "completed",
                "entity_type": Status.ENTITY_ACTIVITY,
                "is_initial": False,
                "is_terminal": True,
                "locks_fields": True,
            },
            {
                "name": "Отменена",
                "code": "canceled",
                "entity_type": Status.ENTITY_ACTIVITY,
                "is_initial": False,
                "is_terminal": True,
                "locks_fields": True,
            },
        ]
        for status_data in campaign_statuses + activity_statuses:
            self.create_status(**status_data)

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
        ]
        for name, url in channels:
            Channel.objects.get_or_create(name=name, defaults={"url": url})

        sources = [
            ("ВКонтакте", "API"),
            ("Telegram", "API"),
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

        self.create_demo_campaigns(
            managers=[manager, manager_2],
            executors=[executor, executor_2, executor_3],
        )

        self.stdout.write(self.style.SUCCESS(
            "Seed-данные созданы. Логины: admin/manager/manager2/executor/executor2/executor3/head, пароль 12345678."
        ))

    def create_demo_campaigns(self, managers, executors):
        campaign_statuses = {
            status.code: status
            for status in Status.objects.filter(entity_type=Status.ENTITY_CAMPAIGN)
        }
        activity_statuses = {
            status.code: status
            for status in Status.objects.filter(entity_type=Status.ENTITY_ACTIVITY)
        }
        channels = {channel.name: channel for channel in Channel.objects.all()}
        sources = {source.name: source for source in MetricSource.objects.all()}
        metric_types = {metric.name: metric for metric in MetricType.objects.all()}

        campaigns = [
            {
                "name": "Приемная кампания бакалавриата — 2026",
                "manager": managers[0],
                "executor": executors[0],
                "goal": "Привлечь абитуриентов на очные программы бакалавриата.",
                "budget": 250000,
                "start_offset": -10,
                "duration": 70,
                "status": "active",
                "activities": [
                    ("Серия постов о программах бакалавриата", "Telegram", "Telegram", "in_progress", [("Просмотры", 12000, 7600), ("Заявки", 150, 84)]),
                    ("Публикации в сообществе университета", "ВКонтакте", "ВКонтакте", "planned", [("Просмотры", 18000, 0), ("Переходы", 900, 0)]),
                ],
            },
            {
                "name": "День открытых дверей — осень 2026",
                "manager": managers[1],
                "executor": executors[1],
                "goal": "Увеличить количество регистраций на мероприятие для абитуриентов.",
                "budget": 95000,
                "start_offset": 5,
                "duration": 25,
                "status": "draft",
                "activities": [
                    ("Анонс мероприятия на сайте", "Официальный сайт", "Ручной ввод", "planned", [("Регистрации", 220, 0), ("Переходы", 1500, 0)]),
                    ("Email-приглашение по базе абитуриентов", "Email-рассылка", "Ручной ввод", "planned", [("Переходы", 600, 0), ("Заявки", 80, 0)]),
                ],
            },
            {
                "name": "Продвижение магистратуры — 2026",
                "manager": managers[0],
                "executor": executors[2],
                "goal": "Повысить интерес к программам магистратуры среди выпускников бакалавриата.",
                "budget": 175000,
                "start_offset": -35,
                "duration": 55,
                "status": "completed",
                "activities": [
                    ("Посты с историями выпускников", "ВКонтакте", "ВКонтакте", "completed", [("Просмотры", 14000, 15120), ("Лайки", 400, 486), ("Комментарии", 70, 64)]),
                    ("Подборка программ в Telegram", "Telegram", "Telegram", "completed", [("Просмотры", 9000, 9750), ("Заявки", 100, 118)]),
                ],
            },
            {
                "name": "Информационная кампания колледжа — 2026",
                "manager": managers[1],
                "executor": executors[0],
                "goal": "Проинформировать абитуриентов и родителей о программах колледжа.",
                "budget": 130000,
                "start_offset": -5,
                "duration": 45,
                "status": "active",
                "activities": [
                    ("Посты с ответами на вопросы", "Telegram", "Ручной ввод", "in_progress", [("Просмотры", 8000, 3400), ("Комментарии", 120, 51)]),
                    ("Материалы на официальном сайте", "Официальный сайт", "Ручной ввод", "planned", [("Переходы", 1100, 0), ("Заявки", 90, 0)]),
                ],
            },
        ]

        for campaign_data in campaigns:
            start_date = date.today() + timedelta(days=campaign_data["start_offset"])
            campaign, _ = Campaign.objects.update_or_create(
                name=campaign_data["name"],
                defaults={
                    "responsible_user": campaign_data["manager"],
                    "executor": campaign_data["executor"],
                    "goal": campaign_data["goal"],
                    "budget": campaign_data["budget"],
                    "start_date": start_date,
                    "end_date": start_date + timedelta(days=campaign_data["duration"]),
                    "status": campaign_statuses[campaign_data["status"]],
                },
            )
            for activity_name, channel_name, source_name, status_code, metrics in campaign_data["activities"]:
                activity, _ = Activity.objects.update_or_create(
                    campaign=campaign,
                    name=activity_name,
                    defaults={
                        "channel": channels[channel_name],
                        "metric_source": sources[source_name],
                        "description": f"Демонстрационная активность кампании «{campaign.name}».",
                        "status": activity_statuses[status_code],
                    },
                )
                for metric_name, planned, actual in metrics:
                    MetricValue.objects.update_or_create(
                        activity=activity,
                        metric_type=metric_types[metric_name],
                        defaults={"planned_value": planned, "actual_value": actual},
                    )

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

    def create_status(
        self,
        name,
        code,
        entity_type,
        is_initial=False,
        is_terminal=False,
        locks_fields=False,
    ):
        status, _ = Status.objects.update_or_create(
            name=name,
            entity_type=entity_type,
            defaults={
                "code": code,
                "is_initial": is_initial,
                "is_terminal": is_terminal,
                "locks_fields": locks_fields,
            },
        )
        return status

    def create_transition(self, from_name, to_name, entity_type):
        from_status = Status.objects.get(name=from_name, entity_type=entity_type)
        to_status = Status.objects.get(name=to_name, entity_type=entity_type)
        StatusTransition.objects.get_or_create(from_status=from_status, to_status=to_status)
