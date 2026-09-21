from django.conf import settings
from django.db import migrations


class Migration(migrations.Migration):
    # Keep the migration ID: deployed databases already record it as applied.
    # Data created earlier is left untouched; new databases receive no demo data.
    dependencies = [
        ("core", "0003_statustransition"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = []
