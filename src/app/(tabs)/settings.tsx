/** 07 設定（マイ）：自動チェックイン・写真・記録・データの出典 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { notificationsAllowed } from '@/auto/notify';
import {
  type AutoPermission,
  getAutoPermission,
  openSystemSettings,
  requestAutoPermission,
  syncAuto,
} from '@/auto/service';
import { getExcludedStations, setExcluded } from '@/db/queries';
import { DWELL_OPTIONS } from '@/db/settings';
import { useLive, useMaster, useMutate, useSettings } from '@/db/provider';
import { ActionSheet } from '@/ui/ActionSheet';
import { Icon } from '@/ui/Icon';
import { BadgeRow } from '@/ui/NumberingBadge';
import { TabScreen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Note, PrimaryButton, Segmented, SettingRow, Switch } from '@/ui/controls';
import { colors } from '@/ui/theme';

const MODES = [
  { id: 'confirm', label: '確認してから記録', hint: '見つけた駅は通知とホームに表示されます。確認してから記録します。' },
  { id: 'instant', label: 'すぐに記録', hint: '見つけた駅をそのまま記録します。あとから編集・削除できます。' },
] as const;

const PERMISSION_LABEL: Record<AutoPermission, string> = {
  always: '常に許可',
  'when-in-use': '使用中のみ',
  denied: '許可しない',
  undetermined: '未設定',
  unavailable: 'この端末では使えません',
};

export default function SettingsScreen() {
  const master = useMaster();
  const mutate = useMutate();
  const [settings, set] = useSettings();
  const excluded = useLive((db) => getExcludedStations(db));
  const [permission, setPermission] = useState<AutoPermission>('undetermined');
  const [explain, setExplain] = useState(false);
  const [dwellSheet, setDwellSheet] = useState(false);

  // 設定アプリから戻ってきたときに、許可の状態を読み直す
  useFocusEffect(
    useCallback(() => {
      getAutoPermission().then(setPermission);
    }, []),
  );

  const autoBlocked = settings.autoEnabled && permission !== 'always';

  const toggleAuto = async (on: boolean) => {
    if (!on) {
      set('autoEnabled', false);
      await syncAuto();
      return;
    }
    if (permission === 'always') {
      set('autoEnabled', true);
      await notificationsAllowed(true);
      await syncAuto();
      return;
    }
    // 許可を求める前に、何のために使うかを説明する
    setExplain(true);
  };

  const grant = async () => {
    setExplain(false);
    const p = await requestAutoPermission();
    setPermission(p);
    set('autoEnabled', true);
    if (p === 'always') {
      await notificationsAllowed(true);
      await syncAuto();
    }
  };

  return (
    <TabScreen gap={28} testID="settings-screen">
      <Text size={20} weight={700} accessibilityRole="header">
        設定
      </Text>

      <View style={{ gap: 14 }}>
        <SectionTitle>自動チェックイン</SectionTitle>
        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}>
          <View
            style={{
              width: 40, height: 40, borderRadius: 999, backgroundColor: colors.ink,
              alignItems: 'center', justifyContent: 'center',
            }}>
            <Icon name="signal" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text size={15} weight={700}>
              自動チェックイン
            </Text>
            <Text size={12} leading={1.5} color={colors.sub}>
              駅に着くと自動で見つけて記録します
            </Text>
          </View>
          <Switch
            label="自動チェックイン"
            value={settings.autoEnabled}
            onChange={toggleAuto}
            disabled={permission === 'unavailable'}
          />
        </View>

        {permission === 'unavailable' && (
          <Note>自動チェックインは iPhone・Android のアプリで使えます。</Note>
        )}
        {autoBlocked && permission !== 'unavailable' && (
          <View
            testID="auto-blocked"
            style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <Text size={13} weight={700}>
              位置情報が「{PERMISSION_LABEL[permission]}」になっています
            </Text>
            <Text size={12} leading={1.6} color={colors.body}>
              アプリを閉じているときに駅に着いたことを知るには、位置情報を「常に許可」にする必要があります。
              「使用中のみ」のままでも、駅の記録・まとめて登録・写真から記録はすべて使えます。
            </Text>
            <Pressable accessibilityRole="button" onPress={openSystemSettings} style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
              <Text size={13} weight={700}>
                設定アプリで変更する
              </Text>
            </Pressable>
          </View>
        )}

        {settings.autoEnabled && (
          <View style={{ gap: 18 }}>
            <View style={{ gap: 10 }}>
              <Text size={13} weight={700}>
                記録のしかた
              </Text>
              <Segmented
                options={MODES}
                value={settings.autoMode}
                onChange={(v) => set('autoMode', v)}
                label="記録のしかた"
                fontSize={13}
              />
              <Text size={12} leading={1.6} color={colors.sub}>
                {MODES.find((m) => m.id === settings.autoMode)?.hint}
              </Text>
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline }}>
              <SettingRow
                title="乗り換えも記録する"
                description="改札内で別の路線に乗り継いだ駅"
                right={<Switch label="乗り換えも記録する" value={settings.autoTransfer} onChange={(v) => set('autoTransfer', v)} />}
              />
              <SettingRow
                title="通過した駅も記録する"
                description="乗ったまま通り過ぎた駅。次のバージョンで対応します"
                right={<Switch label="通過した駅も記録する" value={false} onChange={() => {}} disabled />}
              />
              <SettingRow
                testID="dwell-row"
                title="「降りた」と判定する時間"
                description="駅の近くにこの時間いたら記録します"
                right={
                  <Text size={14} weight={600}>
                    {settings.dwellMinutes}分
                  </Text>
                }
                onPress={() => setDwellSheet(true)}
              />
              <SettingRow
                title="除外する駅"
                description="毎日使う駅は自動で記録しません"
                right={
                  <Text size={14} weight={600}>
                    {excluded.length}駅
                  </Text>
                }
                onPress={() => router.push('/search?mode=exclude')}
                last={excluded.length > 0}
              />
              {excluded.length > 0 && (
                <View
                  style={{
                    paddingBottom: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 6,
                    borderBottomWidth: 1, borderBottomColor: colors.hairline,
                  }}>
                  {excluded.map((id) => {
                    const s = master.station(id);
                    if (!s) return null;
                    return (
                      <Pressable
                        key={id}
                        accessibilityRole="button"
                        accessibilityLabel={`${s.name}を除外する駅から外す`}
                        onPress={() => mutate((db) => setExcluded(db, id, false))}
                        style={{
                          height: 32, paddingLeft: 6, paddingRight: 10, borderRadius: 999,
                          backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6,
                        }}>
                        <BadgeRow badges={master.badges(id)} max={1} size={24} showMore={false} />
                        <Text size={13} weight={600}>
                          {s.name}
                        </Text>
                        <Icon name="close" size={12} color={colors.sub} strokeWidth={2.4} />
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <SettingRow
                title="位置情報"
                description="自動チェックインには「常に許可」が必要です"
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {permission === 'always' && <Icon name="check" size={14} strokeWidth={2.4} />}
                    <Text size={13} weight={600}>
                      {PERMISSION_LABEL[permission]}
                    </Text>
                  </View>
                }
                onPress={openSystemSettings}
              />
              <SettingRow
                title="省電力モード"
                description="電池を節約します。駅の判定が少し遅れることがあります"
                right={
                  <Switch
                    label="省電力モード"
                    value={settings.batterySaver}
                    onChange={(v) => set('batterySaver', v)}
                  />
                }
              />
            </View>
          </View>
        )}
      </View>

      <View style={{ gap: 6 }}>
        <SectionTitle>写真</SectionTitle>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline, marginTop: 8 }}>
          <SettingRow
            title="近くで撮った写真を提案"
            description="記録するとき、その駅の近くで撮った写真を表示します"
            right={<Switch label="近くで撮った写真を提案" value={settings.suggestPhotos} onChange={(v) => set('suggestPhotos', v)} />}
          />
          <SettingRow
            title="共有するとき撮影場所を消す"
            description="写真を書き出すときに位置情報を取り除きます"
            right={
              <Switch
                label="共有するとき撮影場所を消す"
                value={settings.stripLocationOnShare}
                onChange={(v) => set('stripLocationOnShare', v)}
              />
            }
          />
          <SettingRow
            testID="open-photo-import-settings"
            title="写真から記録"
            description="過去の写真の撮影場所から、訪れた駅を見つけます"
            onPress={() => router.push('/photo-import')}
          />
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <SectionTitle>記録</SectionTitle>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline, marginTop: 8 }}>
          <SettingRow
            title="「通過」を達成率に数える"
            description="乗ったまま通り過ぎた駅も、訪れた駅として数えます"
            right={
              <Switch
                label="「通過」を達成率に数える"
                value={settings.countPass}
                onChange={(v) => set('countPass', v)}
              />
            }
          />
          <SettingRow title="すべての記録" onPress={() => router.push('/visits')} />
          <SettingRow testID="open-sources" title="データの出典" onPress={() => router.push('/sources')} />
        </View>
      </View>

      <PermissionExplain visible={explain} onCancel={() => setExplain(false)} onContinue={grant} />
      <ActionSheet
        visible={dwellSheet}
        onClose={() => setDwellSheet(false)}
        title="「降りた」と判定する時間"
        actions={DWELL_OPTIONS.map((m) => ({
          label: `${m}分`,
          selected: settings.dwellMinutes === m,
          onPress: () => set('dwellMinutes', m),
        }))}
      />
    </TabScreen>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text size={11} weight={600} tracking={0.04} color={colors.sub} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** 「常に許可」を求める前の説明（ストア審査でも求められる）。 */
function PermissionExplain({
  visible,
  onCancel,
  onContinue,
}: {
  visible: boolean;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(24,24,27,0.4)', justifyContent: 'flex-end' }}>
        <View
          testID="permission-explain"
          style={{
            backgroundColor: colors.white,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 24,
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 20),
            gap: 18,
          }}>
          <View
            style={{
              width: 48, height: 48, borderRadius: 999, backgroundColor: colors.ink,
              alignItems: 'center', justifyContent: 'center',
            }}>
            <Icon name="signal" size={24} color={colors.white} />
          </View>
          <Text size={20} weight={700} leading={1.4}>
            駅に着いたことを、自動で見つけます
          </Text>
          <View style={{ gap: 12 }}>
            <Bullet>アプリを閉じていても、駅の近くに来たときだけ位置を確かめます。そのため位置情報を「常に許可」にしてください。</Bullet>
            <Bullet>ふだんは OS の省電力のしくみで見張り、細かく位置を取るのは駅の近くの数分だけです。</Bullet>
            <Bullet>位置の記録は端末の中だけに保存し、外に送ることはありません。</Bullet>
            <Bullet>許可しなくても、駅の記録・まとめて登録・写真から記録はすべて使えます。</Bullet>
          </View>
          <View style={{ gap: 8 }}>
            <PrimaryButton label="許可して始める" onPress={onContinue} testID="permission-continue" />
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Text size={15} weight={600} color={colors.sub}>
                今はやめておく
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: colors.ink, marginTop: 9 }} />
      <Text size={14} leading={1.6} color={colors.body} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}
