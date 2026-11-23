'use strict';
const supported = ['de','en','es','fr','it'];
const page = document.documentElement.dataset.page;
const requested = new URLSearchParams(location.search).get('lang');
const first = (navigator.languages?.[0] || navigator.language || 'en').split(/[-_]/)[0].toLowerCase();
const lang = supported.includes(requested) ? requested : supported.includes(first) ? first : 'en';
location.replace('/mind-support/' + lang + '/' + page + '/');
