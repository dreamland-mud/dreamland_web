# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import sys
import csv
from searcher.models import *
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

class Command(BaseCommand):
    help = 'Loads all magic items from a given CSV file'

    def add_arguments(self, parser):
        parser.add_argument('fname', type=str)
        parser.add_argument('wipe', type=str)

    def handle(self, *args, **options):
        with open(options['fname'], 'rb') as csvfile:
            with transaction.atomic():
		if options['wipe'] == 'true': 
		    MagicItem.objects.all().delete()

                reader = csv.DictReader(csvfile)
                for row in reader:
                    magic = MagicItem()
                    magic.vnum = row['vnum']
                    magic.name = row['name']
                    magic.level = row['level']
                    magic.itemtype = row['itemtype']
                    magic.spellLevel = row['spellLevel']
                    magic.charges = row['charges']
                    magic.spells = row['spells']
                    magic.area = row['area']
                    magic.where = row['where']
                    magic.limit = row['limit']

                    if magic.vnum:
                    	magic.save()

                        print repr(magic)
		
		if MagicItem.objects.count() < 10:
		    sys.exit('Magic items file ' + options['fname'] + ' is too small, aborting.')

	
