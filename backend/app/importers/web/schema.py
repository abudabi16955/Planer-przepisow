import html
import json
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser

from app.importers.web.fetch import WebImportError


@dataclass
class Node:
    tag: str
    attrs: dict
    children: list = field(default_factory=list)

    def text(self):
        if self.tag in ("script", "style", "noscript"):
            return ""
        text = " ".join(
            child.text() if isinstance(child, Node) else child for child in self.children
        )
        return text + ("\n" if self.tag in ("li", "p", "br") else "")


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root", {})
        self.stack = [self.root]
        self.count = 0

    def handle_starttag(self, tag, attrs):
        self.count += 1
        if self.count > 50000 or len(self.stack) > 128:
            raise WebImportError("no_recipe")
        node = Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in (
            "area",
            "base",
            "br",
            "col",
            "embed",
            "hr",
            "img",
            "input",
            "link",
            "meta",
            "param",
            "source",
            "track",
            "wbr",
        ):
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if self.stack[-1].tag == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def nodes(root):
    yield root
    for child in root.children:
        if isinstance(child, Node):
            yield from nodes(child)


def clean(value):
    if not isinstance(value, str):
        return ""
    parser = Tree()
    parser.feed(html.unescape(value[:20000]))
    return re.sub(r"\s+", " ", parser.root.text()).strip()


def is_recipe(value):
    types = value.get("@type", [])
    return any(
        str(kind).rstrip("/") in ("Recipe", "https://schema.org/Recipe", "http://schema.org/Recipe")
        for kind in (types if isinstance(types, list) else [types])
    )


def json_recipes(value, depth=0):
    if depth > 64:
        return
    if isinstance(value, dict):
        if is_recipe(value):
            yield value
        for child in value.values():
            if isinstance(child, (dict, list)):
                yield from json_recipes(child, depth + 1)
    elif isinstance(value, list):
        for child in value:
            yield from json_recipes(child, depth + 1)


def micro(node):
    result = {}

    def visit(parent):
        for child in parent.children:
            if not isinstance(child, Node):
                continue
            props = child.attrs.get("itemprop", "").split()
            if props:
                if "itemscope" in child.attrs:
                    value = micro(child)
                    value["@type"] = child.attrs.get("itemtype", "").rstrip("/").split("/")[-1]
                else:
                    value = child.attrs.get(
                        "content",
                        child.attrs.get(
                            "datetime",
                            child.attrs.get("src", child.attrs.get("href", child.text())),
                        ),
                    )
                for prop in props:
                    result.setdefault(prop, []).append(value)
            if "itemscope" not in child.attrs:
                visit(child)

    visit(node)
    return {key: value[0] if len(value) == 1 else value for key, value in result.items()}


def extract(html_text):
    parser = Tree()
    parser.feed(html_text)
    for node in nodes(parser.root):
        if (
            node.tag == "script"
            and node.attrs.get("type", "").lower().split(";", 1)[0].strip() == "application/ld+json"
        ):
            try:
                value = json.loads(
                    "".join(child for child in node.children if isinstance(child, str))
                )
                for recipe in json_recipes(value):
                    if clean(recipe.get("name")):
                        return recipe
            except (ValueError, RecursionError):
                continue
    for node in nodes(parser.root):
        if any(
            kind.rstrip("/") in ("https://schema.org/Recipe", "http://schema.org/Recipe")
            for kind in node.attrs.get("itemtype", "").split()
        ):
            recipe = micro(node)
            if clean(recipe.get("name")):
                return recipe
    raise WebImportError("no_recipe")


def duration(value):
    if not isinstance(value, str):
        return None
    match = re.fullmatch(
        r"P(?:(\d+)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?",
        value.upper(),
    )
    if not match or not any(match.groups()):
        return None
    days, hours, minutes, seconds = [
        float(part.replace(",", ".")) if part else 0 for part in match.groups()
    ]
    total = days * 1440 + hours * 60 + minutes + seconds / 60
    return max(1, int(total + 0.999999)) if 0 < total <= 525600 else None


def instructions(value):
    if isinstance(value, str):
        return [
            line
            for part in re.split(r"\r?\n|<br\s*/?>|</(?:p|li)>", value, flags=re.IGNORECASE)
            if (line := clean(part))
        ][:500]
    if isinstance(value, list):
        return [step for child in value[:500] for step in instructions(child)][:500]
    if isinstance(value, dict):
        if "itemListElement" in value:
            return instructions(value["itemListElement"])
        return instructions(value.get("text", value.get("name", "")))
    return []
