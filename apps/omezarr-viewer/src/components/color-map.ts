// an IM-gui widget for controlling the display of a single channel

// an IM-gui widget for controlling the display of a single channel
import type { Interval } from '@alleninstitute/vis-geometry';
import { ImGui } from '@zhobo63/imgui-ts';
import type { ImTuple2 } from '@zhobo63/imgui-ts/src/bind-imgui';
import { ImGuiColorEditFlags, ImGuiSliderFlags, ImVec4 } from '@zhobo63/imgui-ts/src/imgui';

// assumes its mid-frame of an IMGui.newFrame() when called!

export function colorMapWidget(
    channel: string,
    mutable: {
        useMe: boolean;
        color: ImVec4;
        gamut: Interval;
        index: number;
    },
    numChannels: number
) {
    const channelChoices = new Array<number>(numChannels).map((n) => n.toFixed(0));
    const getter = (data: string[], index: number, out: [string]) => {
        out[0] = data[index];
        return false;
    };
    let changed = false;
    const { gamut, color } = mutable;
    let index = mutable.index;
    const range: ImTuple2<number> = [gamut.min, gamut.max];
    if (
        ImGui.Checkbox('', (b?: boolean) => {
            mutable.useMe = b ?? mutable.useMe;
            return mutable.useMe;
        })
    ) {
        changed = true;
    }
    ImGui.SameLine();
    ImGui.ColorButton(' ', color, ImGuiColorEditFlags.NoAlpha);
    ImGui.SameLine();
    ImGui.PushItemWidth(10);
    if (
        ImGui.DragInt(
            `${channel}_options`,
            (i?: number) => {
                index = i ?? index;
                return index;
            },
            0.2,
            0,
            numChannels - 1,
            '%i'
        )
    ) {
        changed = true;
        mutable.index = index;
    }
    ImGui.PopItemWidth();

    ImGui.SameLine();
    if (ImGui.SliderFloat2(channel, range, 0, 9999, '%3f', ImGuiSliderFlags.Logarithmic)) {
        mutable.gamut = { min: range[0], max: range[1] };
        changed = true;
    }
    return { changed, ...mutable };
}
