# dreamland_web
DreamLand MUD: static web site pages and searcher Django app.

## Подготовка окружения

Здесь описаны шаги, которые необходимо проделать один раз для инициализации окружения.
Инструкция проверялась на свежепоставленной Ubuntu 16.04, в других системах команды могут отличаться, а необходимые пакеты уже присутствовать.

### Инициализация питонового окружения
Необходим Python версии от 2.7 и его система управления пакетами (pip):
```
sudo apt-get update
sudo apt-get install python python-pip
```
Создать и активировать виртуальное окружение (имя - любое):
```
pip install virtualenv
virtualenv django-env 
. django-env/bin/activate
```
Инсталлировать необходимые пакеты внутри виртуального окружения:
```
pip install django
pip install djangorestframework
pip install django-filter==1.1.0
pip install django-cors-headers
```
### Инициализация проекта
Скачать исходники и инициализировать базу данных:
```
sudo apt-get install git
git clone https://github.com/dreamland-mud/dreamland_web.git
cd dreamland_web/website
./manage.py migrate
```
Создать локального админа:
```
./manage.py createsuperuser
```

### Генерация сайта из исходников
Установить утилиту для XSLT-процессинга
```
sudo apt-get install xsltproc
```
Сгенерировать страницы из исходников (будет жаловаться на ненайденные файлы, но для локального тестирования это неважно):
```
cd dreamland_web/static
./make-all.sh
```

## Локальное тестирование

### Запуск локального django-сервера
Каждый раз перед началом работы необходимо будет выполнить два шага: активировать виртуальное окружение и запустить в нем сервер.
```
. django-env/bin/activate
cd dreamland_web/website
./manage.py runserver
```
После этого можно пользоваться админ-интерфейсом и тестировать поисковые запросы, зайдя на http://localhost:8000/admin.
Также через этот интерфейс можно создать несколько экземпляров брони и оружия, чтобы было, что отображать в таблице.

Убедиться, что поисковые запросы из JS идут на локальный сервер, а не на официальный сайт, установив 
переменную внутри dreamland_web/static/js/searcher.js:
```
var appUrl = 'http://127.0.0.1:8000/searcher-api'
```

### Запуск локального сайта
В браузере заходим на file:///path/to/dreamland_web/static/index.html для заглавной страницы или на file:///path/to/dreamland_web/static/searcher.html для поисковика


