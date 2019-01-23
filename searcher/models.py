# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from django.db import models

class Item(models.Model):
    WEARLOC_CHOICES = (
        ('none', 'нет'),
        ('light', 'свет'),
        ('finger', 'палец'),
        ('neck', 'шея'),
        ('body', 'вокруг тела'),
        ('head', 'голова'),
        ('legs', 'бедра'),
        ('feet', 'ноги'),
        ('hands', 'руки'),
        ('arms', 'плечи'),
        ('shield', 'щит'),
        ('torso', 'на тело'),
        ('waist', 'талия'),
        ('wrist', 'запястье'),
        ('wield', 'оружие'),
        ('hold', 'в руках'),
        ('float', 'кружится'),
        ('face', 'лицо'),
        ('ears', 'уши'),
        ('horse', 'лошадиное тело'),
        ('hooves', 'копыта'),
    )

    vnum = models.IntegerField(db_index=True, unique=True)
    name = models.CharField(max_length=100)
    level = models.IntegerField()
    wearloc = models.CharField(
            max_length=16, 
            choices=WEARLOC_CHOICES,
            default='none',)
    itemtype = models.CharField(max_length=16, default='unknown')
    hr = models.IntegerField(default=0)
    dr = models.IntegerField(default=0)
    hp = models.IntegerField(default=0)
    mana = models.IntegerField(default=0)
    move = models.IntegerField(default=0)
    saves = models.IntegerField(default=0)
    armor = models.IntegerField(default=0)
    stat_str = models.IntegerField(default=0)
    stat_int = models.IntegerField(default=0)
    stat_wis = models.IntegerField(default=0)
    stat_dex = models.IntegerField(default=0)
    stat_con = models.IntegerField(default=0)
    stat_cha = models.IntegerField(default=0)
    stat_size = models.IntegerField(default=0)
    affects = models.CharField(max_length=256, default='')
    area = models.CharField(max_length=256, default='')
    where = models.CharField(max_length=256, default='')
    limit = models.IntegerField(default=-1)
    
    def __repr__ (self):
        return u"<item vnum=%s lvl=%s armor=%s>" % (self.vnum, self.level, self.armor)




class Weapon(models.Model):
    WCLASS_CHOICES = (
        ( 'none',    'нет' ), 
        ( 'exotic',  'экзотика' ), 
        ( 'sword',   'меч' ), 
        ( 'dagger',  'кинжал' ), 
        ( 'staff',   'шест' ),
        ( 'spear',   'копье' ), 
        ( 'mace',    'булава' ), 
        ( 'axe',     'топор' ), 
        ( 'flail',   'цеп' ), 
        ( 'whip',    'плетка' ), 
        ( 'polearm', 'алебарда' ), 
        ( 'bow',     'лук' ), 
        ( 'arrow',   'стрела' ), 
        ( 'lance',   'пика' ), 
        ( 'stone',   'камень' ),
    )

# Header: vnum,name,level,weaponclass,special,d1,d2,ave,hr,dr,hp,mana,saves,ac,str,int,wis,dex,con,area,where,limit

    vnum = models.IntegerField(db_index=True, unique=True)
    name = models.CharField(max_length=100)
    level = models.IntegerField()
    wclass = models.CharField(
            max_length=16, 
            choices=WCLASS_CHOICES,
            default='none',)
    special = models.CharField(max_length=100, default='')
    d1 = models.IntegerField(default=0)
    d2 = models.IntegerField(default=0)
    ave = models.IntegerField(default=0)
    hr = models.IntegerField(default=0)
    dr = models.IntegerField(default=0)
    hp = models.IntegerField(default=0)
    mana = models.IntegerField(default=0)
    saves = models.IntegerField(default=0)
    armor = models.IntegerField(default=0)
    stat_str = models.IntegerField(default=0)
    stat_int = models.IntegerField(default=0)
    stat_wis = models.IntegerField(default=0)
    stat_dex = models.IntegerField(default=0)
    stat_con = models.IntegerField(default=0)
    area = models.CharField(max_length=256, default='')
    where = models.CharField(max_length=256, default='')
    limit = models.IntegerField(default=-1)
    
    def __repr__ (self):
        return u"<weapon vnum=%s lvl=%s>" % (self.vnum, self.level)

class MagicItem(models.Model):
    ITEMTYPE_CHOICES = (
        ( 'none',    'нет' ), 
        ( 'potion',  'зелье' ), 
        ( 'pill',  'лекарство' ), 
        ( 'scroll',   'свиток' ), 
        ( 'wand',  'жезл' ), 
        ( 'staff',  'посох' ), 
        ( 'spellbook',  'книга заклинаний' ), 
        ( 'warp_stone',  'искажающий камень' ), 
    )

# Header: vnum,name,level,type,spellLevel,charges,spells,area,where,limit

    vnum = models.IntegerField(db_index=True, unique=True)
    name = models.CharField(max_length=100)
    level = models.IntegerField()
    itemtype = models.CharField(
            max_length=16, 
            choices=ITEMTYPE_CHOICES,
            default='none',)
    spellLevel = models.IntegerField(default=0)
    charges = models.IntegerField(default=0)
    spells = models.CharField(max_length=256, default='')
    area = models.CharField(max_length=256, default='')
    where = models.CharField(max_length=256, default='')
    limit = models.IntegerField(default=-1)
    
    def __repr__ (self):
        return u"<magicItem vnum=%s lvl=%s type=%s>" % (self.vnum, self.level, self.itemtype)

class Pet(models.Model):

# Header: vnum,name,level,act,aff,off,area

    vnum = models.IntegerField(db_index=True, unique=True)
    name = models.CharField(max_length=100)
    level = models.IntegerField()
    act = models.CharField(max_length=256, default='')
    aff = models.CharField(max_length=256, default='')
    off = models.CharField(max_length=256, default='')
    area = models.CharField(max_length=256, default='')
    
    def __repr__ (self):
        return u"<pet vnum=%s lvl=%s>" % (self.vnum, self.level)

