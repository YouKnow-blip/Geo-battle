/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameLocation } from '../types';

export const GAME_LOCATIONS: GameLocation[] = [
  {
    id: 'loc_paris_eiffel',
    pKey: '1173994786358482', // Eiffel Tower Area, Paris
    lat: 48.8584,
    lng: 2.2945,
    name: 'Вид на Эйфелеву башню',
    country: 'Франция',
    description: 'Легендарная железная башня XIX века, расположенная на Марсовом поле у реки Сены.',
    imageUrl: 'https://images.unsplash.com/photo-1431274172761-fca41d930114?auto=format&fit=crop&w=2400&q=90'
  },
  {
    id: 'loc_tokyo_shibuya',
    pKey: '2032488820465529', // Shibuya Crossing, Tokyo
    lat: 35.6596,
    lng: 139.7005,
    name: 'Перекресток Сибуя',
    country: 'Япония',
    description: 'Один из самых оживленных пешеходных перекресток в мире, знаменитый своими гигантскими рекламными ЛЕД-экранами.',
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=2400&q=90'
  },
  {
    id: 'loc_ny_times_square',
    pKey: '2424424933931811', // Times Square, New York
    lat: 40.7580,
    lng: -73.9851,
    name: 'Таймс-сквер',
    country: 'США',
    description: 'Светящийся неоном коммерческий перекресток, главный туристический хаб Нью-Йорка и знаменитый центр развлечений.',
    imageUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=2400&q=90'
  },
  {
    id: 'loc_rome_colosseum',
    pKey: '1766487847065620', // Colosseum, Rome
    lat: 41.8902,
    lng: 12.4922,
    name: 'Колизей',
    country: 'Италия',
    description: 'Величественный древнеримский амфитеатр, построенный в самом сердце Рима во времена правления императоров династии Флавиев.',
    imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=2400&q=90'
  },
  {
    id: 'loc_sydney_opera',
    pKey: '1412028591829029', // Sydney Opera House
    lat: -33.8568,
    lng: 151.2153,
    name: 'Сиднейский оперный театр',
    country: 'Австралия',
    description: 'Многофункциональный театр в Сиднейской гавани, признанный архитектурным шедевром благодаря парусообразным сводам крыши.',
    imageUrl: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=2400&q=90'
  },
  {
    id: 'loc_rio_copacabana',
    pKey: '1928392102839120', // Copacabana, Rio
    lat: -22.9707,
    lng: -43.1823,
    name: 'Пляж Копакабана',
    country: 'Бразилия',
    description: 'Всемирно известный 4-километровый песчаный пляж полумесяцем, окруженный оживленными уличными заведениями в Рио-де-Жанейро.',
    imageUrl: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=2400&q=90'
  },
  {
    id: 'loc_sf_golden_gate',
    pKey: '991202839182910', // Golden Gate Bridge area
    lat: 37.8199,
    lng: -122.4783,
    name: 'Мост Золотые Ворота',
    country: 'США',
    description: 'Культовый висячий мост через одноименный пролив, соединяющий залив Сан-Франциско с тихим округом Марин.',
    imageUrl: 'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&w=2400&q=90'
  },
  {
    id: 'loc_reykjavik',
    pKey: '827192837192812', // Scenic Reykjavik vista
    lat: 64.1466,
    lng: -21.9426,
    name: 'Набережная Рейкьявика',
    country: 'Исландия',
    description: 'Живописная прибрежная парковая дорожка с видом на северную гору Эсья через холодные воды бухты Фахсафлоуи.',
    imageUrl: 'https://images.unsplash.com/photo-1504829857797-ddff28127792?auto=format&fit=crop&w=2400&q=90'
  },
  {
    id: 'loc_cairo_pyramids',
    pKey: '121928391028391', // Pyramids area, Cairo
    lat: 29.9792,
    lng: 31.1342,
    name: 'Пирамиды Гизы',
    country: 'Египет',
    description: 'Древнейшее чудо света на окраине пустыни Сахара — великие гробницы фараонов и охраняющий их загадочный Сфинкс.',
    imageUrl: 'https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=2400&q=90'
  },
  {
    id: 'loc_venice_canal',
    pKey: '441028391829102', // Grand Canal, Venice
    lat: 45.4381,
    lng: 12.3181,
    name: 'Гранд-канал Венеции',
    country: 'Италия',
    description: 'Главная водная артерия Венеции, окруженная историческими мраморными палаццо эпохи Возрождения.',
    imageUrl: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=2400&q=90'
  },
  {
    id: 'loc_groot_constantia',
    pKey: '551928391829102', // constantia, Cape Town
    lat: -33.9249,
    lng: 18.4241,
    name: 'Склоны Столовой горы',
    country: 'ЮАР',
    description: 'Величественная гора с полностью плоской вершиной, возвышающаяся как природный монумент над Кейптауном.',
    imageUrl: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=2400&q=90'
  },
  {
    id: 'loc_london_ Westminster',
    pKey: '394879210214820', // Big Ben view
    lat: 51.5007,
    lng: -0.1246,
    name: 'Вестминстерский мост',
    country: 'Великобритания',
    description: 'Величественное неоготическое здание Парламента Великобритании и башня Биг-Бен прямо на берегу реки Темзы.',
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=2400&q=90'
  }
];

export function getRandomLocation(): GameLocation {
  const index = Math.floor(Math.random() * GAME_LOCATIONS.length);
  return GAME_LOCATIONS[index];
}

export function getLocationById(id: string): GameLocation {
  return GAME_LOCATIONS.find(loc => loc.id === id) || GAME_LOCATIONS[0];
}
