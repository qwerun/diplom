import json
import re
from urllib.parse import urlencode, urlparse, parse_qs
from urllib.request import urlopen

from django.conf import settings
from asgiref.sync import async_to_sync
from rest_framework import serializers


class MetricApiError(serializers.ValidationError):
    pass


def http_get_json(url, params):
    query = urlencode(params)
    with urlopen(f"{url}?{query}", timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_vk_post_url(result_url):
    parsed = urlparse(result_url)
    candidates = [parsed.path]
    query = parse_qs(parsed.query)
    if "w" in query:
        candidates.extend(query["w"])

    for value in candidates:
        match = re.search(r"wall(-?\d+)_(\d+)", value)
        if match:
            return f"{match.group(1)}_{match.group(2)}"
    raise MetricApiError("Не удалось найти id поста VK в ссылке. Нужна ссылка вида https://vk.com/wall-1_2.")


def fetch_vk_metrics(result_url):
    if not settings.VK_ACCESS_TOKEN:
        raise MetricApiError("Не задан VK_ACCESS_TOKEN в .env.")

    post_id = parse_vk_post_url(result_url)
    data = http_get_json(
        "https://api.vk.com/method/wall.getById",
        {
            "posts": post_id,
            "access_token": settings.VK_ACCESS_TOKEN,
            "v": settings.VK_API_VERSION,
        },
    )
    if "error" in data:
        message = data["error"].get("error_msg", "VK API вернул ошибку.")
        raise MetricApiError(message)

    response = data.get("response", [])
    print('response', response)
    items = response.get("items", []) if isinstance(response, dict) else []
    post = items[0] if items else None

    if not post:
        raise MetricApiError("VK API не вернул данные по посту.")

    return {
        "просмотры": post.get("views", {}).get("count", 0),
        "лайки": post.get("likes", {}).get("count", 0),
        "комментарии": post.get("comments", {}).get("count", 0),
        "репосты": post.get("reposts", {}).get("count", 0),
    }


def fetch_telegram_metrics(result_url):
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
    except ImportError as error:
        raise MetricApiError("Для Telegram API установите зависимость Telethon из requirements.txt.") from error

    if not settings.TELEGRAM_API_ID or not settings.TELEGRAM_API_HASH or not settings.TELEGRAM_SESSION_STRING:
        raise MetricApiError("Для Telegram задайте TELEGRAM_API_ID, TELEGRAM_API_HASH и TELEGRAM_SESSION_STRING в .env.")

    channel, message_id = parse_telegram_post_url(result_url)

    try:
        session = StringSession(settings.TELEGRAM_SESSION_STRING.strip())
        api_id = int(settings.TELEGRAM_API_ID)
    except ValueError as error:
        raise MetricApiError("TELEGRAM_SESSION_STRING некорректен или TELEGRAM_API_ID не является числом.") from error

    proxy = telegram_proxy()

    async def load_message():
        async with TelegramClient(
            session,
            api_id,
            settings.TELEGRAM_API_HASH,
            proxy=proxy,
            use_ipv6=False,
            timeout=settings.TELEGRAM_TIMEOUT,
            connection_retries=settings.TELEGRAM_CONNECTION_RETRIES,
        ) as client:
            return await client.get_messages(channel, ids=message_id)

    try:
        message = async_to_sync(load_message)()
    except TimeoutError as error:
        raise MetricApiError(
            "Telegram API недоступен по сети. Проверьте TELEGRAM_PROXY_HOST/PORT или доступ сервера к Telegram."
        ) from error
    except Exception as error:
        raise MetricApiError(f"Telegram API не смог получить сообщение: {error}") from error
    print('message', message)
    if not message:
        raise MetricApiError("Telegram API не вернул сообщение по ссылке.")

    reactions_count = 0
    if message.reactions and message.reactions.results:
        reactions_count = sum(item.count for item in message.reactions.results)

    comments_count = 0
    if message.replies:
        comments_count = message.replies.replies or 0

    return {
        "просмотры": message.views or 0,
        "лайки": reactions_count,
        "комментарии": comments_count,
        "репосты": message.forwards or 0,
    }


def parse_telegram_post_url(result_url):
    parsed = urlparse(result_url)
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) >= 2 and parts[-1].isdigit():
        return parts[-2], int(parts[-1])
    raise MetricApiError("Не удалось найти Telegram-пост. Нужна ссылка вида https://t.me/channel/123.")


def telegram_proxy():
    if not settings.TELEGRAM_PROXY_HOST:
        return None
    try:
        port = int(settings.TELEGRAM_PROXY_PORT)
    except ValueError as error:
        raise MetricApiError("TELEGRAM_PROXY_PORT должен быть числом.") from error
    return (
        settings.TELEGRAM_PROXY_TYPE or "http",
        settings.TELEGRAM_PROXY_HOST,
        port,
    )


def fetch_external_metrics(metric_source, result_url):
    source_name = metric_source.name.lower()
    if "vk" in source_name or "вк" in source_name or "вконтакте" in source_name:
        return fetch_vk_metrics(result_url)
    if "telegram" in source_name or "телеграм" in source_name:
        return fetch_telegram_metrics(result_url)
    raise MetricApiError(f"Для источника «{metric_source.name}» интеграция API не настроена.")
