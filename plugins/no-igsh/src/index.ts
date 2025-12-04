import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";

const messageModule = findByProps("sendMessage", "receiveMessage");

const patches =  [
	before("sendMessage", messageModule, (args) => {
        args[1].content = args[1].content.replace(/\?igsh=[^&\s]*/g, "");
    }),
];

export default {
    onUnload: () => {
        patches.forEach(p => p());
    },
}