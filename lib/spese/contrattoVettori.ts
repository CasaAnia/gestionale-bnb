// ============================================================================
// VETTORI DI PROVA COMUNI client/server per la forma canonica e la sua
// impronta (PROPOSTA-RECUPERO-REVISIONE.md §2.6): gli stessi valori
// dovranno produrre gli stessi «canonico» e SHA-256 anche nel collaudo
// dell'implementazione SQL — se una delle due canonicalizzazioni
// divergesse, il replay tra client e server non potrebbe funzionare.
// Il caso «null espliciti e undefined assenti» parte dal valore CON il
// campo undefined: la forma canonica deve ometterlo.
// ============================================================================
export const VETTORI: { nome: string; tipo?: 'manifesto_conferma'; valore: unknown; canonico: string; sha256: string }[] = [
  {
    "nome": "oggetto semplice, chiavi da riordinare",
    "valore": {
      "b": 1,
      "a": "x"
    },
    "canonico": "{\"a\":\"x\",\"b\":1}",
    "sha256": "cdab067e9f3beb32d1252cfd63e492592fecbf591b0d08cadb24bb17f3864246"
  },
  {
    "nome": "numeri nella forma minima",
    "valore": {
      "zero": 0,
      "dec": 0.472,
      "mezzo": 12.5,
      "uno": 1,
      "negativo": -0.01,
      "grande": 123456.78
    },
    "canonico": "{\"dec\":0.472,\"grande\":123456.78,\"mezzo\":12.5,\"negativo\":-0.01,\"uno\":1,\"zero\":0}",
    "sha256": "2fe998ffc4f0da526d73b9caca848b2a69ea07e88c7a36ade34cb277e6a79f20"
  },
  {
    "nome": "null espliciti e undefined assenti",
    "valore": {
      "a": null,
      "c": "c"
    },
    "canonico": "{\"a\":null,\"c\":\"c\"}",
    "sha256": "3ecf6eb2d7ce37cb6d5617dc27c9ef149545767820d34293a4a9e287b5e5a8e6"
  },
  {
    "nome": "unicode e apostrofi",
    "valore": {
      "nome": "Aceto “bio” ×2 — l'unità",
      "euro": "€"
    },
    "canonico": "{\"euro\":\"€\",\"nome\":\"Aceto “bio” ×2 — l'unità\"}",
    "sha256": "90e64d8f42ab0855ac3f6769fada2c9c4991517ebe69cc77d96f840cd55a39d9"
  },
  {
    "nome": "liste annidate",
    "valore": {
      "righe": [
        {
          "id": "r2",
          "v": 2
        },
        {
          "id": "r1",
          "v": 1
        }
      ],
      "vuota": []
    },
    "canonico": "{\"righe\":[{\"id\":\"r2\",\"v\":2},{\"id\":\"r1\",\"v\":1}],\"vuota\":[]}",
    "sha256": "de8c34dc578371cc2b5f39057a97fb1874b30c291007e76595ebdea994b4a5fb"
  },
  {
    "nome": "manifesto salva realistico",
    "valore": {
      "kind": "salva",
      "document_id": "d-rev",
      "base_rev": 3,
      "doc_total": 12.5,
      "bozze": {
        "b-rev-mia": {
          "store": "Iper",
          "subcategory": null
        }
      },
      "righe": {
        "rb1": {
          "amount": 4.5,
          "qty": 0.472
        }
      },
      "nuove": [
        {
          "client_ref": "loc-1",
          "draft_id": "b-rev-mia",
          "name": "Sacchetto",
          "amount": 0.5,
          "qty": 1,
          "unit_price": null,
          "discount": 0,
          "group_id": null,
          "category_id": null,
          "subcategory": null,
          "canonical_category_id": null,
          "canonical_subcategory_id": null,
          "necessity": null,
          "planning": null
        }
      ]
    },
    "canonico": "{\"base_rev\":3,\"bozze\":{\"b-rev-mia\":{\"store\":\"Iper\",\"subcategory\":null}},\"doc_total\":12.5,\"document_id\":\"d-rev\",\"kind\":\"salva\",\"nuove\":[{\"amount\":0.5,\"canonical_category_id\":null,\"canonical_subcategory_id\":null,\"category_id\":null,\"client_ref\":\"loc-1\",\"discount\":0,\"draft_id\":\"b-rev-mia\",\"group_id\":null,\"name\":\"Sacchetto\",\"necessity\":null,\"planning\":null,\"qty\":1,\"subcategory\":null,\"unit_price\":null}],\"righe\":{\"rb1\":{\"amount\":4.5,\"qty\":0.472}}}",
    "sha256": "c611f5740f1b7d000059a71e642cfcbb7b85999e79db9be49ed6ac3763c77761"
  },
  {
    "nome": "manifesto conferma con correzioni ordinate",
    "valore": {
      "kind": "conferma",
      "document_id": "d-rev",
      "base_rev": 4,
      "correzioni": [
        {
          "field": "store",
          "proposed": "Mercato",
          "corrected": "Iper",
          "draft_id": "b1"
        }
      ]
    },
    "canonico": "{\"base_rev\":4,\"correzioni\":[{\"corrected\":\"Iper\",\"draft_id\":\"b1\",\"field\":\"store\",\"proposed\":\"Mercato\"}],\"document_id\":\"d-rev\",\"kind\":\"conferma\"}",
    "sha256": "0cf82cde4c8aa9512e5418c8adda3967e2f3cf6c26baeace312bf6a8f27c23d4"
  },
  {
    "nome": "manifesto scarto",
    "valore": {
      "kind": "scarto",
      "document_id": "d-rev",
      "base_rev": 2,
      "motivo": "foto doppia"
    },
    "canonico": "{\"base_rev\":2,\"document_id\":\"d-rev\",\"kind\":\"scarto\",\"motivo\":\"foto doppia\"}",
    "sha256": "6afa68fb1fb5fda0e4c8424876b3d8207fe173b5fba1a228b0f36022d5155f15"
  },
  {
    "nome": "manifesto conferma con correzioni DA RIORDINARE (il server deve ordinarle allo stesso modo)",
    "tipo": "manifesto_conferma",
    "valore": {
      "document_id": "d-rev",
      "base_rev": 4,
      "correzioni": [
        {
          "field": "amount",
          "proposed": 5,
          "corrected": 6,
          "draft_id": "b1",
          "draft_item_id": "r1"
        },
        {
          "field": "store",
          "proposed": "Mercato",
          "corrected": "Iper",
          "draft_id": "b1"
        },
        {
          "field": "doc_total",
          "proposed": 5,
          "corrected": 6
        }
      ]
    },
    "canonico": "{\"base_rev\":4,\"correzioni\":[{\"corrected\":6,\"field\":\"doc_total\",\"proposed\":5},{\"corrected\":\"Iper\",\"draft_id\":\"b1\",\"field\":\"store\",\"proposed\":\"Mercato\"},{\"corrected\":6,\"draft_id\":\"b1\",\"draft_item_id\":\"r1\",\"field\":\"amount\",\"proposed\":5}],\"document_id\":\"d-rev\",\"kind\":\"conferma\"}",
    "sha256": "47a9fd6a219abf80a2df5e0aa72b2abbf5c74cec74a17f11b2b675966de387d1"
  }
]
