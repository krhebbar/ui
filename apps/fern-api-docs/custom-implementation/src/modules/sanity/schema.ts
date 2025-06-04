export const ORIGIN = 'https://docs.devrev.ai'

export const HEADER_V3_SCHEMA = `
    ...,
    logo {
      "link": link -> ,
    },
    links[]{
      ...,
      main {
        ...,
        listing {
          ...,
          items[] {
            ...,
            "link": link -> ,
            "icon": icon.asset -> ,
            "children": children[] {
              ...,
              "link": link -> ,
            }
          }
        },
        "article": article -> {
          _type,
          title,
          "image": coalesce(thumbnail -> url, image.asset -> url),
          "tags": category[] -> title,
          "slug": slug.current,
        },
        footer {
          ...,
          "link": link -> ,
        },
        banner {
          ...,
          button {
            ...,
            "link": link -> ,
          },
        },
      },
      side {
        ...,
        listing {
          ...,
          items[] {
            ...,
            "link": link -> ,
            "icon": icon.asset -> ,  
          }
        },
        banner {
          ...,
          button {
            ...,
            "link": link -> ,
          },
        },
        "article": article -> {
          _type,
          title,
          "image": coalesce(thumbnail -> url, image.asset -> url),
          "tags": category[] -> title,
          "slug": slug.current,
        },
        footer {
          ...,
          "link": link -> ,
        },
      },
      footer {
        ...,
        "link": link -> ,
      },
      "link": link -> ,
    },
    actions[] {
      ...,
      "link": link -> ,
    },`

export const FOOTER_V3_SCHEMA = `
    ...,
    compliance {
      ...,
      "link": link -> ,
      "icon": icon.asset -> url,
    },
    logo {
      ...,
      "link": link -> ,
    },
    groups[] {
      ...,
      items[] {
        ...,
        "link": link -> ,
      },
    },
`
