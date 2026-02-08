# SearXNG Query Optimizer
Take advantage of query parameters supported SearXNG Search API to improve search "hit rate". 

## Relevant Parameters
- categories : optional - Comma separated list, specifies the active search categories (see Configured Engines)

- engines : optional - Comma separated list, specifies the active search engines (see Configured Engines).

- language : default from search: - Code of the language.

- pageno : default 1 - Search page number.

- time_range : optional - [ day, month, year ] Time range of search for engines which support it. See if an engine supports time range search in the preferences page of an instance.

- format : optional - [ json, csv, rss ] Output format of results. Format needs to be activated in search:. 

## Useful Paramters 
- **categories**
- **time_range**
- **format=json**

### Useful Categories and Sub-Categories
- general
    - books
    - currency
    - translate
    - web
    - wikimedia
- images
    - icons
    - web
- video
    - web
- news
    - web
    - wikimedia
- map
- music
    - lyrics
    - radio
- it (IT/Technology)
    - packages
    - q&a
    - repos
    - software_wikis
- science
    - scientific_publications
    - wikimedia
- files
    - apps 
    - books
- social_media

#### Using Categories
**URL template**: /search?q=[!(category)]+*(keyword)

**Example**: /search?q=!news+!it+openai+codex

1. aim for precise match, including combination, e.g. lyrics, books, or (it,news)
2. top-level categories, including combinations, e.g. it, news
3. fall back to general, always
<!-- 4. if no result returned, fall back to general -->

### Time Range
**Example**: /search?q=openai+codex&time_range=month

1. alway try to specify time range
2. none by default

## Prompt Engineering
- Categorisation
- Time range

    

