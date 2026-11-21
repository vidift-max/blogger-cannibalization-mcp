# Architecture Registry

The registry is the platform-side source of truth for article assembly.

It deliberately does not expose implementation code to the content provider.

## Version 1

- Template: `article`
- Slots: header, intro, body, interactions, related_carousel, faq, conclusion
- Interaction renderer: platform-owned
- Related-link selector: platform-owned
- Provider responsibility: editorial content only

## CSS and JavaScript boundary

CSS and JavaScript are implementation assets of the platform. Future designer work must register components and their selectors here rather than adding implementation requirements to the provider prompt.

## Provider boundary

The provider may describe content and structured interaction data. It must not emit:

- HTML;
- CSS;
- JavaScript;
- inline styles;
- arbitrary component names;
- publication URLs for related content.

## Future integration

The final assembly pipeline should be:

1. fetch/receive structured editorial content;
2. validate provider output;
3. normalize blocks;
4. render blocks into the platform template;
5. select related articles from the online Blogger corpus;
6. select supported interactions;
7. render the registered CSS/JS components;
8. run SEO/cannibalization checks;
9. preview;
10. require approval before publishing.
