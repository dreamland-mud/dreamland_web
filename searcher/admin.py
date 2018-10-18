# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from django.contrib import admin
from .models import Item,Weapon,MagicItem

admin.site.register(Item)
admin.site.register(Weapon)
admin.site.register(MagicItem)

