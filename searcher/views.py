# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.shortcuts import render
from django.http import HttResponse
# Create your views here.
def index(request):
    return HttResponse("Welcome to the site")
