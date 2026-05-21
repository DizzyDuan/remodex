// FILE: SidebarBottomActionBar.swift
// Purpose: Bottom-anchored sidebar bar. Hosts (from leading to trailing) the
//          optional circular devices menu, the Terminal pill, and the primary Chat
//          pill. Pills are built from the same reusable `SidebarActionPill`
//          component so they share font, icon size, padding and capsule shape
//          — only the style differs. The devices menu reuses the sidebar's
//          shared glass-circle treatment so it reads as a peer of the
//          Terminal pill. iOS 26 wraps the whole row in `AdaptiveGlassContainer`
//          so each piece participates in the same Liquid Glass sampling region.
// Layer: View Component
// Exports: SidebarBottomActionBar
// Depends on: SwiftUI, SidebarActionPill, SidebarDevicesMenuButton,
//             AdaptiveGlassModifier

import SwiftUI

struct SidebarBottomActionBar: View {
    @Environment(CodexService.self) private var codex
    @AppStorage(MyDeviceSwitcherVisibilityStore.key)
    private var switcherModeRawValue = MyDeviceSwitcherVisibilityStore.defaultMode.rawValue

    let isChatEnabled: Bool
    let isCreatingThread: Bool
    let isSwitchingMac: Bool
    let switchingMacDeviceId: String?
    let onTapChat: () -> Void
    let onTapTerminal: () -> Void
    let onSelectTrustedDevice: (String) -> Void
    let onOpenDevicesSettings: () -> Void

    var body: some View {
        Group {
            if #available(iOS 26.0, *) {
                iOS26LiquidGlassLayout
            } else {
                iOS18FallbackLayout
            }
        }
        .padding(.horizontal, 16)
        // safeAreaBar(edge:.bottom) on iOS 26 already adds the system safe-area
        // inset, so we only need a tiny visual gap above/below the controls.
        .padding(.top, 6)
        .padding(.bottom, 4)
    }

    // MARK: - Pills (built from the shared SidebarActionPill component)

    private var devicesMenu: SidebarDevicesMenuButton {
        SidebarDevicesMenuButton(
            diameter: pillHeight,
            isSwitchingMac: isSwitchingMac,
            switchingMacDeviceId: switchingMacDeviceId,
            onSelectDevice: onSelectTrustedDevice,
            onOpenDevicesSettings: onOpenDevicesSettings
        )
    }

    private var shouldShowDevicesMenu: Bool {
        let visibleDeviceCount = MyDevicesPresentation
            .rowModels(from: codex, switchingDeviceId: switchingMacDeviceId)
            .filter(\.isVisibleInMenu)
            .count

        let switcherMode = MyDeviceSwitcherVisibilityMode(rawValue: switcherModeRawValue)
            ?? MyDeviceSwitcherVisibilityStore.defaultMode
        switch switcherMode {
        case .automatic:
            return isSwitchingMac || visibleDeviceCount > 1
        case .always:
            return isSwitchingMac || visibleDeviceCount > 0
        case .hidden:
            return isSwitchingMac
        }
    }

    private var terminalPill: SidebarActionPill {
        SidebarActionPill(
            title: "Terminal",
            iconSystemName: "terminal.fill",
            style: .glass,
            hapticStyle: .light,
            accessibilityLabel: "Terminal",
            onTap: onTapTerminal
        )
    }

    private var chatPill: SidebarActionPill {
        SidebarActionPill(
            title: "Chat",
            iconSystemName: "square.and.pencil",
            style: .accent,
            isEnabled: isChatEnabled,
            isLoading: isCreatingThread,
            accessibilityLabel: "New chat",
            onTap: onTapChat
        )
    }

    // Matches the resolved height of the glass `SidebarActionPill`
    // (icon 20 + vertical padding 12 * 2 ≈ 44) so the circle button sits flush
    // with the Terminal pill.
    private var pillHeight: CGFloat { 44 }

    // MARK: - Layouts

    private var iOS26LiquidGlassLayout: some View {
        // Groups the devices menu, Terminal and Chat pills in the same native
        // Liquid Glass sampling region so the glass backgrounds stay
        // consistent with the surrounding sidebar surface.
        AdaptiveGlassContainer(spacing: 10) {
            pillRow
        }
    }

    private var iOS18FallbackLayout: some View {
        pillRow
    }

    private var pillRow: some View {
        HStack(spacing: 10) {
            if shouldShowDevicesMenu {
                devicesMenu
            }
            terminalPill
            Spacer(minLength: 0)
            chatPill
        }
    }
}

#if DEBUG
#Preview {
    SidebarBottomActionBar(
        isChatEnabled: true,
        isCreatingThread: false,
        isSwitchingMac: false,
        switchingMacDeviceId: nil,
        onTapChat: {},
        onTapTerminal: {},
        onSelectTrustedDevice: { _ in },
        onOpenDevicesSettings: {}
    )
    .environment(CodexService())
}
#endif
