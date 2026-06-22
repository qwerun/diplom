from django.contrib import admin

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


admin.site.register(UserProfile)
admin.site.register(Status)
admin.site.register(StatusTransition)
admin.site.register(Channel)
admin.site.register(MetricSource)
admin.site.register(Campaign)
admin.site.register(Activity)
admin.site.register(ActivityResult)
admin.site.register(ActivityMedia)
admin.site.register(MetricType)
admin.site.register(MetricValue)
admin.site.register(Report)
