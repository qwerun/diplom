from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_activitymedia"),
    ]

    operations = [
        migrations.CreateModel(
            name="StatusTransition",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "from_status",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="outgoing_transitions", to="core.status"),
                ),
                (
                    "to_status",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="incoming_transitions", to="core.status"),
                ),
            ],
            options={
                "ordering": ["from_status__entity_type", "from_status__name", "to_status__name"],
            },
        ),
        migrations.AddConstraint(
            model_name="statustransition",
            constraint=models.UniqueConstraint(fields=("from_status", "to_status"), name="unique_status_transition"),
        ),
    ]
