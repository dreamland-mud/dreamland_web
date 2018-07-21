# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import sys
import csv
from searcher.models import *
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

class Command(BaseCommand):
    help = 'Loads all weapons from a given CSV file'

    def add_arguments(self, parser):
        parser.add_argument('fname', type=str)
        parser.add_argument('wipe', type=str)

    def handle(self, *args, **options):
        with open(options['fname'], 'rb') as csvfile:
            with transaction.atomic():
		if options['wipe'] == 'true': 
		    Weapon.objects.all().delete()

                reader = csv.DictReader(csvfile)
                for row in reader:
                    weapon = Weapon()
                    weapon.vnum = row['vnum']
                    weapon.name = row['name']
                    weapon.level = row['level']
                    weapon.wclass = row['wclass']
                    weapon.special = row['special']
                    weapon.d1 = row['d1']
                    weapon.d2 = row['d2']
                    weapon.ave = row['ave']
                    weapon.hr = row['hr']
                    weapon.dr = row['dr']
                    weapon.hp = row['hp']
                    weapon.mana = row['mana']
                    weapon.saves = row['saves']
                    weapon.amor = row['armor']
                    weapon.stat_str = row['str']
                    weapon.stat_int = row['int']
                    weapon.stat_wis = row['wis']
                    weapon.stat_dex = row['dex']
                    weapon.stat_con = row['con']
                    weapon.area = row['area']
                    weapon.where = row['where']
                    weapon.limit = row['limit']

                    if weapon.vnum:
                    	weapon.save()

                        print repr(weapon)
		
		if Weapon.objects.count() < 10:
		    sys.exit('Weapons file ' + options['fname'] + ' is too small, aborting.')

	
