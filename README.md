# dreamland_web
DreamLand MUD: static web site pages and searcher Django app.

## Инструкции по локальному тестированию

Необходим Python версии от 2.7. 

### Инициализация окружения
Инсталлировать pip
```
apt-get install python python-pip
```
Создать и активировать виртуальное окружение (имя - любое).
```
pip install virtualenv
virtualenv django-env 
. django-env/bin/activate
```
Инсталлировать необходимые пакеты внутри виртуального окружения.
```
pip install django
pip install djangorestframework
pip install django-filter
```
### Инициализация проекта
Скачать исходники и инициализировать базу данных:
```
git clone https://github.com/dreamland-mud/dreamland_web.git
cd dreamland_web/website
./manage.py migrate
```
Создать локального админа:
```
./manage.py createsuperuser
```
### Запуск локального django-сервера
Каждый раз перед началом работы необходимо будет выполнить два шага:
активировать виртуальное окружение и запустить в нем сервер.
```
. django-env/bin/activate
cd dreamland_web/website
./manage.py runserver
```
После этого можно пользоваться админ-интерфейсом и тестировать поисковые запросы, зайдя на http://localhost:8000/searcher-api.
Также через этот интерфейс можно создать несколько экземпляров брони и оружия, чтобы было, что отображать в таблице.

Убедиться, что поисковые запросы из JS идут на локальный сервер, а не на официальный сайт, установив 
переменную внутри dreamland_web/static/js/searcher.js:
```
var appUrl = 'http://127.0.0.1:8000/searcher-api'
```
### Генерация сайта из исходников
Установить утилиту для XSLT-процессинга
```
apt-get install xsltproc
```
Сгенерировать карты и страницы из исходников:
```
cd dreamland_web/static
./make-all.sh
```

### Запуск локального сайта
В браузере заходим на file:///path/to/dreamland_web/static/index.html для заглавной страницы или на file:///path/to/dreamland_web/static/searcher.html для поисковика
