# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import sys
import csv
from searcher.models import *
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

class Command(BaseCommand):
    help = 'Loads all pets from a given CSV file'

    def add_arguments(self, parser):
        parser.add_argument('fname', type=str)
        parser.add_argument('wipe', type=str)

    def handle(self, *args, **options):
        with open(options['fname'], 'rb') as csvfile:
            with transaction.atomic():
		if options['wipe'] == 'true': 
		    Pet.objects.all().delete()

                reader = csv.DictReader(csvfile)
                for row in reader:
                    pet = Pet()
                    pet.vnum = row['vnum']
                    pet.name = row['name']
                    pet.level = row['level']
                    pet.act = row['act']
                    pet.aff = row['aff']
                    pet.off = row['off']
                    pet.area = row['area']

                    if pet.vnum:
                    	pet.save()

                        print repr(pet)
		
		if Pet.objects.count() < 10:
		    sys.exit('Pets file ' + options['fname'] + ' is too small, aborting.')

	
