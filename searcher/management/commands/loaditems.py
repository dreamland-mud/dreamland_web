# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import sys
import csv
from searcher.models import *
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

class Command(BaseCommand):
    help = 'Loads all items from a given CSV file'

    def add_arguments(self, parser):
        parser.add_argument('fname', type=str)
        parser.add_argument('wipe', type=str)

    def handle(self, *args, **options):
        with open(options['fname'], 'rb') as csvfile:
            with transaction.atomic():
		if options['wipe'] == 'true': 
		    Item.objects.all().delete()

                reader = csv.DictReader(csvfile)
                for row in reader:
                    item = Item()
                    item.vnum = row['vnum']
                    item.name = row['name']
                    item.level = row['level']
                    item.wearloc = row['wearloc']
                    item.itemtype = row['itemtype']
                    item.hr = row['hr']
                    item.dr = row['dr']
                    item.hp = row['hp']
                    item.mana = row['mana']
                    item.move = row['move']
                    item.saves = row['saves']
                    item.stat_str = row['str']
                    item.stat_int = row['int']
                    item.stat_wis = row['wis']
                    item.stat_dex = row['dex']
                    item.stat_con = row['con']
                    item.stat_cha = row['cha']
                    item.align = row['align']
                    item.affects = row['affects']
                    item.area = row['area']
                    item.where = row['where']
                    item.limit = row['limit']

                    if item.vnum:
                    	item.save()

                        print repr(item)
		
		if Item.objects.count() < 10:
		    sys.exit('Objects file ' + options['fname'] + ' is too small, aborting.')

	
