# Система управления рекламными кампаниями университета

## Запуск backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python manage.py makemigrations
python manage.py migrate
python manage.py seed
python manage.py runserver
```

## Запуск frontend

```bash
cd frontend
npm install
npm run dev
```
