import { defineConfig } from "vitepress";

export default defineConfig({
  title: "godot-mcp-pilot",
  description:
    "Model Context Protocol server for Godot 4 — AI-driven game development",
  base: "/godot-mcp-pilot/",

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/godot-mcp-pilot/logo.svg" }],
    ["meta", { name: "theme-color", content: "#478cbf" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Give AI assistants direct control over your Godot 4 game projects.",
      },
    ],
  ],

  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "godot-mcp-pilot",

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Tools", link: "/reference/tools" },
      {
        text: "npm",
        link: "https://www.npmjs.com/package/godot-mcp-pilot",
      },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Configuration", link: "/guide/configuration" },
          { text: "Example Workflows", link: "/guide/workflows" },
          { text: "Troubleshooting", link: "/guide/troubleshooting" },
        ],
      },
      {
        text: "Reference",
        items: [{ text: "Tool Catalog", link: "/reference/tools" }],
      },
    ],

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/pushks18/godot-mcp-pilot",
      },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2025 Pushkaraj Baradkar",
    },

    editLink: {
      pattern:
        "https://github.com/pushks18/godot-mcp-pilot/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    search: {
      provider: "local",
    },
  },
});
