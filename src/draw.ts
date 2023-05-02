import { getSvgPath } from "figma-squircle";
import { User } from "./types";

import * as d3 from "d3-hierarchy";
import Color from "color";

export type RepositoryFilter = (n: User["repositories"]["nodes"][0]) => boolean

interface LangStatItem {
    name: string,
    size: number,
    color: string
}

const getPastDate = (days: number) => {
    const today = new Date();
    const daysAgo = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    return daysAgo
}

const defaultRepositoryFilter: RepositoryFilter = n => {
    if (n.isTemplate || n.archivedAt) {
        return false
    }
    const date = new Date(n.updatedAt);
    if (date.getTime() < getPastDate(365 * 2).getTime()) {
        return false;
    }
    return true;
}

const defaultSize = {
    width: 900,
    height: 246,
}

const defaultPadding = {
    vertical: 0,
    horizontal: 0,
    inner: 4,
}


const defaultOmmitedLanguages = ["CSS", "SCSS", "HTML", "Assembly", "Yacc", "Lex", "Makefile", "CMake", "TeX", "PostScript", "Cypher"];

export const drawLanguageStatSvg = (
    data: { user: User },
    size: { width: number, height: number } = defaultSize,
    padding: { inner: number, vertical: number, horizontal: number } = defaultPadding,
    repositoryFilter: RepositoryFilter = defaultRepositoryFilter,
    ommitedLanguages: string[] = defaultOmmitedLanguages,
    maxItems: number = 12,
    sizeMapper: (originalSize: number) => number = size => size ** 0.6,
    tile: d3.RatioSquarifyTilingFactory = d3.treemapResquarify
): string => {
    const langs = data.user.repositories.nodes
        .filter(repositoryFilter)
        .flatMap(
            n => n.languages.edges.map(
                e => [e.size, e.node.name, e.node.color] as const
            )
        );

    const langDict: Record<string, {
        size: number,
        color: string,
    }> = {};

    langs.forEach(([size, lang, col]) => {
        if (langDict[lang] === undefined) {
            langDict[lang] = {
                size: 0,
                color: col
            }
        }
        langDict[lang].size += size;
    })

    ommitedLanguages.forEach(lang => {
        delete langDict[lang];
    });

    const renderData = Object.entries(langDict)
        .map(it => ({ name: it[0], size: sizeMapper(it[1].size), color: it[1].color }))
        .sort(
            (a, b) => b.size - a.size
        )
        .slice(0, maxItems);


    const root = d3.stratify<LangStatItem>().path((d) => d.name.replace(/\./g, "/"))(renderData);

    root.sum(d => Math.max(0, d?.size ?? 0));
    root.sort((a, b) => b.data.size - a.data.size)

    d3.treemap<any>()
        .tile(tile)
        .size([size.width, size.height])
        .paddingInner(padding.inner)
        .paddingTop(padding.vertical)
        .paddingRight(padding.horizontal)
        .paddingBottom(padding.vertical)
        .paddingLeft(padding.horizontal)
        (root);

    const final: ({
        x0: number,
        y0: number,
        x1: number,
        y1: number,
    } & LangStatItem)[] = []


    root.children?.forEach(d => {
        final.push({
            ...d.data,
            x0: (d as any).x0,
            y0: (d as any).y0,
            x1: (d as any).x1,
            y1: (d as any).y1,
        })
    });

    const allSize = Object.entries(langDict).map(it => it[1].size).reduce((a, b) => a + b, 0);

    const rectItems = final.map(d => {
        const isLightColor = new Color(d.color).luminosity() > .4;
        const p = getSvgPath({
            cornerRadius: 6,
            width: d.x1 - d.x0,
            height: d.y1 - d.y0,
            cornerSmoothing: 0.9,
        });
        const textColor = isLightColor ? "#000000ff" : "#ffffff";
        const textColor2 = isLightColor ? "#00000080" : "#ffffffa0";
        return `<g transform="translate(${d.x0}, ${d.y0})">
        <clipPath id="clip-${d.name}">
            <path d="${p}" />
        </clipPath>
        <path d="${p}" fill="${d.color}" title="${d.name}"/>
        <text clip-path="url(#clip-${d.name})" x="6" y="6" class="n" fill="${textColor}">${d.name}</text>
        <text clip-path="url(#clip-${d.name})" x="6" y="25" class="per" fill="${textColor2}">${Math.round(langDict[d.name].size / allSize * 1000) / 10}%</text>
        </g>`
    });

    return `<svg width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" xmlns="http://www.w3.org/2000/svg">
    <style>
    text {
        font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        text-anchor: start;
        dominant-baseline: text-before-edge;
        font-size: 12.5px;
        font-weight: 600;
    }
    </style>
        ${rectItems.join("")}
    </svg>`
}