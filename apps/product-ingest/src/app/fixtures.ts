import type { Category, Locale } from '@analog-ecom-ws/product-schema';

export interface ProductFixture {
  sku: string;
  category: Category;
  price: number;
  stock: number;
  sizes: string[];
  colors: string[];
  updatedAt: string;
  content: Record<Locale, { title: string; headline: string; body: string }>;
}

// Hand-authored fixture catalog: 6 products across 2 categories (3 each).
// No external feed, no generation step - this *is* the demo catalog, in
// both languages, checked into the ingest app (overall-goals-design.md §6).
export const PRODUCT_FIXTURES: ProductFixture[] = [
  {
    sku: 'TS-BLK-001',
    category: 'apparel/shirts',
    price: 29.9,
    stock: 42,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['black', 'charcoal'],
    updatedAt: '2026-09-01T00:00:00.000Z',
    content: {
      en: {
        title: 'Classic Crew Tee',
        headline: 'A tee that gets out of the way',
        body: 'Midweight combed cotton, a crew neck that keeps its shape after a wash, and no logo anywhere on it. Cut straight rather than boxy - it layers under an overshirt without adding bulk.',
      },
      de: {
        title: 'Klassisches Rundhals-Shirt',
        headline: 'Ein Shirt, das nicht auffällt',
        body: 'Mittelschwere gekämmte Baumwolle, ein Rundhalsausschnitt, der auch nach dem Waschen seine Form behält, und kein Logo. Gerade geschnitten statt kastig - passt problemlos unter ein Überhemd.',
      },
    },
  },
  {
    sku: 'TS-NVY-002',
    category: 'apparel/shirts',
    price: 34.9,
    stock: 27,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['navy', 'heather-grey'],
    updatedAt: '2026-09-01T00:00:00.000Z',
    content: {
      en: {
        title: 'Everyday Henley',
        headline: 'Three buttons, no fuss',
        body: "A brushed-cotton henley with a three-button placket and a slightly heavier hand than a plain tee. Warm enough on its own on a mild day, thin enough to layer when it isn't.",
      },
      de: {
        title: 'Alltags-Henley',
        headline: 'Drei Knöpfe, kein Schnickschnack',
        body: 'Ein angerauhtes Baumwoll-Henley mit Dreiknopfleiste und etwas mehr Gewicht als ein einfaches Shirt. An milden Tagen warm genug allein, dünn genug zum Kombinieren an kälteren.',
      },
    },
  },
  {
    sku: 'TS-OLV-003',
    category: 'apparel/shirts',
    price: 59.9,
    stock: 15,
    sizes: ['M', 'L', 'XL'],
    colors: ['olive', 'black'],
    updatedAt: '2026-09-01T00:00:00.000Z',
    content: {
      en: {
        title: 'Heavyweight Overshirt',
        headline: 'A shirt that can act like a jacket',
        body: 'Brushed twill, a full button front, and two chest pockets that actually hold something. Heavy enough to wear open over a tee once the temperature drops, without needing an actual coat.',
      },
      de: {
        title: 'Schweres Überhemd',
        headline: 'Ein Hemd, das auch als Jacke taugt',
        body: 'Angerauhter Twill, durchgehende Knopfleiste und zwei Brusttaschen, die wirklich etwas fassen. Schwer genug, um es bei sinkenden Temperaturen offen über einem Shirt zu tragen - ganz ohne Mantel.',
      },
    },
  },
  {
    sku: 'SH-WHT-001',
    category: 'apparel/shoes',
    price: 79.9,
    stock: 33,
    sizes: ['40', '41', '42', '43', '44', '45'],
    colors: ['white', 'white-navy'],
    updatedAt: '2026-09-01T00:00:00.000Z',
    content: {
      en: {
        title: 'Court Sneaker',
        headline: 'The one sneaker that goes with everything',
        body: 'A low-top court shape in smooth leather, a flat sole that actually stays flat, and a shape plain enough to wear with anything else in this catalog. Not trying to be a running shoe.',
      },
      de: {
        title: 'Court-Sneaker',
        headline: 'Der eine Sneaker, der zu allem passt',
        body: 'Ein niedriger Court-Schnitt aus glattem Leder, eine flache Sohle, die tatsächlich flach bleibt, und eine schlichte Form, die zu allem anderen in diesem Katalog passt. Kein Laufschuh-Anspruch.',
      },
    },
  },
  {
    sku: 'SH-BRN-002',
    category: 'apparel/shoes',
    price: 129.9,
    stock: 12,
    sizes: ['41', '42', '43', '44'],
    colors: ['brown', 'black'],
    updatedAt: '2026-09-01T00:00:00.000Z',
    content: {
      en: {
        title: 'Leather Derby',
        headline: 'A shoe you can resole',
        body: 'Full-grain leather uppers on a stitched, resoleable construction - the kind of shoe that gets more comfortable with wear instead of wearing out. Dresses up a shirt without looking dressed up.',
      },
      de: {
        title: 'Leder-Derby',
        headline: 'Ein Schuh, den man neu besohlen kann',
        body: 'Vollnarbenleder auf einer genähten, neu besohlbaren Konstruktion - ein Schuh, der mit der Zeit bequemer wird statt sich abzunutzen. Wertet ein Hemd auf, ohne aufgesetzt zu wirken.',
      },
    },
  },
  {
    sku: 'SH-BLK-003',
    category: 'apparel/shoes',
    price: 94.9,
    stock: 20,
    sizes: ['40', '41', '42', '43', '44', '45'],
    colors: ['black', 'orange'],
    updatedAt: '2026-09-01T00:00:00.000Z',
    content: {
      en: {
        title: 'Trail Runner',
        headline: 'For the walk there and back',
        body: 'A grippy lugged sole and a breathable mesh upper, built for a walk on uneven ground rather than a marathon. The reflective heel tab is the one concession to being seen after dark.',
      },
      de: {
        title: 'Trail-Runner',
        headline: 'Für den Weg hin und zurück',
        body: 'Griffige Stollensohle und atmungsaktives Mesh-Obermaterial, gedacht für unebenes Gelände statt für den Marathon. Der reflektierende Fersenbesatz ist das einzige Zugeständnis an Sichtbarkeit im Dunkeln.',
      },
    },
  },
];
