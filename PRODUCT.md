# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Italian sellers of second-hand goods, in two shapes the product must serve with the same tool: a private person clearing out their home (a handful to a few dozen live listings, occasional sessions, wants it done fast) and a reseller who buys and resells continuously (dozens to hundreds of listings, watches margins, views, likes and price drops). Both work at a desktop browser (Chrome or Edge), with the marketplace sites open in other tabs.

## Product Purpose

Splisto is a browser extension: write a listing once (photos, title, description, price, condition, category, brand, size, colour, weight, dimensions) and have it filled into Vinted, eBay, Subito, Facebook Marketplace and Wallapop, one tab per site. It also imports listings already online, keeps one listing linked across sites, reads views and likes, flags what changed on a site, and helps remove a sold item everywhere so nothing sells twice. Success: listing on five sites costs the effort of one, and the seller always knows where each item is live.

## Positioning

The final "Publish" button is always pressed by the user; Splisto never clicks it (enforced in code). Everything stays on the user's computer (IndexedDB, chrome.storage); the only outside connections are the five sites and, only for the optional AI features, the AI service the user picks. The extension is dormant until used: its site script exists only while a job is running.

## Operating Context

- Dashboard is the extension's options page (`src/dashboard`): home with platform status and listing list, editor, settings.
- Site tabs are opened by the extension; the user logs in, checks each filled form and publishes by hand.
- Optional AI helpers (titles, descriptions, photo review) through Claude by default or other providers.
- Italian UI copy throughout.

## Capabilities and Constraints

- Five platforms, fixed: Vinted, eBay, Subito, Facebook Marketplace, Wallapop. Their official logos ship in `public/logos` (with dark variants and small marks).
- Statuses per site: not sent, filling, filled, to complete, login required, error, published, removed; sold state across sites.
- Bulk edit, per-site title/price/category overrides, net-after-fees estimate, backups as JSON.
- Chrome/Edge Manifest V3; dashboard is React 19 + plain CSS; no UI framework.

## Brand Commitments

- Name: Splisto. Everything else about the look (colours, type, shapes, app icon) is open for redesign (confirmed 2026-10-09).
- Product functions and copy stay.

## Evidence on Hand

- Platform logos in `public/logos`. No testimonials, user counts or press exist; none may be invented.

## Product Principles

1. The user stays in control: the extension prepares, the person publishes.
2. One item, one truth: a listing is the same object on every site, and the dashboard shows where it is and what differs.
3. Quiet until needed: no background activity the user did not turn on.
4. Speed for the occasional seller, depth for the reseller, in the same screens.

## Accessibility & Inclusion

WCAG AA contrast, full keyboard use (including photo reordering), reduced-motion respected.
