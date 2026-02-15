import { findByName, findByStoreName, findByProps } from "@vendetta/metro";
import { after, before } from "@vendetta/patcher";
import { Embed, Message } from "vendetta-extras";
import { findInReactTree } from "@vendetta/utils";
import { React } from "@vendetta/metro/common";
import { General } from "@vendetta/ui/components";

export const LazyActionSheet = findByProps("hideActionSheet");
const { TouchableOpacity } = General;

//import { React } from "@vendetta/metro/common";
//import { after, before } from "@vendetta/patcher";
import { ErrorBoundary, Forms} from "@vendetta/ui/components";

//import openMediaModal from "../lib/utils/openMediaModal";
//import StealButtons from "../ui/components/StealButtons";
//import { findByProps } from "@vendetta/metro";
//import { findInReactTree } from "@vendetta/utils";
//import { LazyActionSheet } from "../modules";

const { FormDivider } = Forms;
//const { TouchableOpacity } = General;

const MessageEmojiActionSheet = findByProps("GuildDetails");

const patches = [];
const { getCustomEmojiById } = findByStoreName("EmojiStore");
const RowManager = findByName("RowManager");
const emojiRegex = /https:\/\/cdn.discordapp.com\/emojis\/(\d+)\.\w+/;

function rewriteChildren(children, replacer) {
  if (typeof children === "string") {
    return replacer(children);
  }

  if (Array.isArray(children)) {
    return children.map(c => rewriteChildren(c, replacer));
  }

  if (children?.props?.children) {
    children.props.children =
      rewriteChildren(children.props.children, replacer);
  }

  return children;
}

patches.push(before("generate", RowManager.prototype, ([data]) => {
  if (data.rowType !== 1) return;

  let content = data.message.content as string;
  if (!content?.length) return;
  const matchIndex = content.match(emojiRegex)?.index;
  if (matchIndex === undefined) return;
  const emojis = content.slice(matchIndex).trim().split("\n");
  if (!emojis.every((s) => s.match(emojiRegex))) return;
  content = content.slice(0, matchIndex);

  while (content.indexOf("  ") !== -1)
    content = content.replace("  ", ` ${emojis.shift()} `);

  content = content.trim();
  if (emojis.length) content += ` ${emojis.join(" ")}`;

  const embeds = data.message.embeds as Embed[];
  for (let i = 0; i < embeds.length; i++) {
    const embed = embeds[i];
    if (embed.type === "image" && embed.url.match(emojiRegex))
      embeds.splice(i--, 1);
  }

  data.message.content = content;
  data.__realmoji = true;
}));

patches.push(after("generate", RowManager.prototype, ([data], row) => {
  if (data.rowType !== 1 || data.__realmoji !== true) return;
  const { content } = row.message as Message;
  if (!Array.isArray(content)) return;

  const jumbo = content.every((c) => (c.type === "link" && c.target.match(emojiRegex)) || (c.type === "text" && c.content === " "));

  for (let i = 0; i < content.length; i++) {
    const el = content[i];
    if (el.type !== "link") continue;

    const match = el.target.match(emojiRegex);
    if (!match) continue;
    const url = `${match[0]}?size=128`;


    const emoji = getCustomEmojiById(match[1]);
    const name = new URLSearchParams(el.target).get("name");

    content[i] = {
      type: "customEmoji",
      id: match[1],
      alt: (emoji?.name ?? name ?? "<realmoji>") + "__realmoji",
      src: url,
      frozenSrc: url.replace("gif", "webp"),
      jumboable: jumbo ? true : undefined,
    };
  }

  var fnMsg = "This is a FakeNitro emoji and renders like a real emoji only for you. Appears as a link to non-plugin users."


  // low key kinda repurposed some code from stealmoji and  went from there
  const unpatchLazy = before("openLazy", LazyActionSheet, ([lazySheet, name]) => {
        if (name !== "MessageEmojiActionSheet") return;
        unpatchLazy();

        lazySheet.then(module => {
            patches.push(after("default", module, (_, res) => {
		const unpatch = after("type", res, ([{ emojiNode }]: [{ emojiNode: EmojiNode }], res) => {
        		React.useEffect(() => () => void (unpatch()), []);
        
        		if (!emojiNode.src) return;
			
        
        		const view = res?.props?.children?.props?.children;
        		if (!view) return;
        
        		const unpatchView = after("type", view, (_, component) => {
        		  React.useEffect(() => unpatchView, []);
			  var title = findInReactTree(component, n => typeof n?.props?.children === "string");
			  if (!title) return;
			  if (!title.props.children.includes("__realmoji")) return;
			  title.props.children = title.props.children.replace("__realmoji", "")
			  var sub   = findInReactTree(component, n => typeof n?.props?.children === "string" && n != title)
			  if (!sub) return
		  	  sub.props.children += "\n" + fnMsg
                	  patches.push(unpatch);
			});
            	});
        }));
    });

});
}))

export const onUnload = () => patches.forEach((unpatch) => unpatch());
