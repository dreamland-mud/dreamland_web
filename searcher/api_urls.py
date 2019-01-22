from django.core.exceptions import ValidationError
from django.conf.urls import url, include
from django.db.models import Q
from .models import *
from rest_framework import routers, serializers, viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from django_filters.rest_framework import FilterSet, RangeFilter, ChoiceFilter

#
# Item
#
class ItemFilter(FilterSet):
    level__range = RangeFilter(name='level')
    wearloc = ChoiceFilter(choices=Item.WEARLOC_CHOICES)
    class Meta:
        model = Item
        fields = ['level__range', 'wearloc']

class ItemSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Item
        fields = '__all__'

class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    filter_class = ItemFilter
    filter_backends = (DjangoFilterBackend,filters.OrderingFilter,filters.SearchFilter)
    search_fields = ('name',)

#
# Weapon
#
class WeaponFilter(FilterSet):
    level__range = RangeFilter(name='level')
    wclass = ChoiceFilter(choices=Weapon.WCLASS_CHOICES)
    class Meta:
        model = Weapon
        fields = ['level__range', 'wclass']

class WeaponSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Weapon 
        fields = '__all__'

class WeaponViewSet(viewsets.ModelViewSet):
    queryset = Weapon.objects.all()
    serializer_class = WeaponSerializer
    filter_class = WeaponFilter
    filter_backends = (DjangoFilterBackend,filters.OrderingFilter,filters.SearchFilter)
    search_fields = ('name',)

#
# Magic Item
#
class MagicItemFilter(FilterSet):
    level__range = RangeFilter(name='level')
    itemtype = ChoiceFilter(choices=MagicItem.ITEMTYPE_CHOICES)
    class Meta:
        model = MagicItem
        fields = ['level__range', 'itemtype']

class MagicItemSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = MagicItem 
        fields = '__all__'

class MagicItemViewSet(viewsets.ModelViewSet):
    queryset = MagicItem.objects.all()
    serializer_class = MagicItemSerializer
    filter_class = MagicItemFilter
    filter_backends = (DjangoFilterBackend,filters.OrderingFilter,filters.SearchFilter)
    search_fields = ('spells',)

#
# Pet
#
class PetFilter(FilterSet):
    level__range = RangeFilter(name='level')
#    wclass = ChoiceFilter(choices=Weapon.WCLASS_CHOICES)
    class Meta:
        model = Pet
        fields = ['level__range']

class PetSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Pet 
        fields = '__all__'

class PetViewSet(viewsets.ModelViewSet):
    queryset = Pet.objects.all()
    serializer_class = PetSerializer
    filter_class = PetFilter
    filter_backends = (DjangoFilterBackend,filters.OrderingFilter,filters.SearchFilter)
    search_fields = ('name',)

api_router = routers.DefaultRouter()
api_router.register(r'item', ItemViewSet)
api_router.register(r'weapon', WeaponViewSet)
api_router.register(r'magicItem', MagicItemViewSet)
api_router.register(r'pet', PetViewSet)

urlpatterns = api_router.urls
