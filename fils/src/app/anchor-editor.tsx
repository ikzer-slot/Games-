import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Autocomplete, inputStyle } from '@/components/Autocomplete';
import { confirmAsync } from '@/components/confirm';
import { Button, Screen } from '@/components/ui';
import { isComplete, newId, slugify } from '@/core/normalize';
import { ANCHOR_KINDS, type AncestorRelation, type Anchor, type AnchorKind } from '@/core/types';
import { ACTIVITIES, CITIES, EVENTS, JOBS, SCHOOLS, WORKPLACES, type CatalogItem } from '@/data/catalog';
import { t } from '@/i18n';
import { useApp, type AnchorTarget } from '@/state/AppContext';
import { colors, font, kindColors, kindEmoji, radius, spacing } from '@/theme';

const THIS_YEAR = new Date().getFullYear();
type Picked = CatalogItem | { key: undefined; label: string };

/**
 * Création / modification d'un point d'ancrage.
 * Paramètres : target=draft|profile, id (édition) ou kind (création).
 */
export default function AnchorEditor() {
  const params = useLocalSearchParams<{ target?: AnchorTarget; id?: string; kind?: AnchorKind }>();
  const target: AnchorTarget = params.target === 'profile' ? 'profile' : 'draft';
  const { anchorsOf, upsertAnchor, removeAnchor } = useApp();
  const existing = params.id ? anchorsOf(target).find((a) => a.id === params.id) : undefined;

  const [kind, setKind] = useState<AnchorKind | undefined>(existing?.kind ?? params.kind);
  const [anchor, setAnchor] = useState<Anchor>(
    existing ?? { id: newId(), kind: params.kind ?? 'city', visible: true, relation: 'grandfather' },
  );
  const [from, setFrom] = useState(existing?.startYear ? String(existing.startYear) : '');
  const [to, setTo] = useState(existing?.endYear ? String(existing.endYear) : '');
  const [busy, setBusy] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // ── Étape 1 : choix du type ───────────────────────────────────────────────
  if (!kind) {
    return (
      <Screen scroll>
        <Header title={t('anchorEditor.chooseKind')} onClose={close} />
        {ANCHOR_KINDS.map((k) => (
          <Pressable
            key={k}
            onPress={() => {
              setKind(k);
              setAnchor((a) => ({ ...a, kind: k }));
            }}
            style={({ pressed }) => [styles.kindRow, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 22 }}>{kindEmoji[k]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[font.body, { fontWeight: '600' }]}>{t(`kinds.${k}`)}</Text>
              <Text style={font.small}>{t(`kindHints.${k}`)}</Text>
            </View>
          </Pressable>
        ))}
      </Screen>
    );
  }

  // ── Étape 2 : formulaire ──────────────────────────────────────────────────
  const setCity = (c: Picked) =>
    setAnchor((a) => {
      const cityKey = c.label ? c.key ?? slugify(c.label) : undefined;
      const next = { ...a, cityKey, cityLabel: c.label || undefined };
      // Pour école / travail, la clé du sujet dépend de la ville.
      if ((a.kind === 'school' || a.kind === 'work') && a.subjectLabel && cityKey) {
        next.subjectKey = `${cityKey}/${slugify(a.subjectLabel)}`;
      }
      return next;
    });

  const setSubject = (s: Picked) => {
    if (kind === 'event') {
      const year = 'year' in s && s.year ? String(s.year) : '';
      setFrom(year);
      setTo(year);
    }
    setAnchor((a) => {
      if (!s.label) return { ...a, subjectKey: undefined, subjectLabel: undefined };
      if (a.kind === 'school' || a.kind === 'work') {
        const item = s as CatalogItem;
        const cityKey = item.cityKey ?? a.cityKey;
        const city = CITIES.find((c) => c.key === cityKey);
        return {
          ...a,
          cityKey,
          cityLabel: city?.label ?? a.cityLabel,
          subjectLabel: s.label,
          subjectKey: cityKey ? `${cityKey}/${slugify(s.label)}` : undefined,
        };
      }
      return { ...a, subjectLabel: s.label, subjectKey: s.key ?? slugify(s.label) };
    });
  };

  const start = from ? parseInt(from, 10) : undefined;
  const end = to ? parseInt(to, 10) : undefined;
  const yearsValid =
    (start === undefined || (start >= 1900 && start <= THIS_YEAR + 1)) &&
    (end === undefined || (end >= 1900 && end <= THIS_YEAR + 1)) &&
    (start === undefined || end === undefined || start <= end);
  const final: Anchor = { ...anchor, kind, startYear: start, endYear: end };
  const canSave = isComplete(final) && yearsValid;

  const save = async () => {
    setBusy(true);
    try {
      await upsertAnchor(target, final);
      close();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmAsync(t('anchorEditor.deleteAnchor'), '', t('common.delete'), t('common.cancel'), true);
    if (!ok) return;
    await removeAnchor(target, existing.id);
    close();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll>
        <Header
          title={existing ? t('anchorEditor.titleEdit') : t(`kinds.${kind}`)}
          color={kindColors[kind]}
          emoji={kindEmoji[kind]}
          onClose={close}
        />
        <KindFields kind={kind} anchor={anchor} setCity={setCity} setSubject={setSubject} setRelation={(relation) => setAnchor((a) => ({ ...a, relation }))} />

        {kind !== 'event' ? (
          <View style={{ gap: spacing(1.5) }}>
            <Text style={styles.label}>{t('anchorEditor.period')}</Text>
            <View style={{ flexDirection: 'row', gap: spacing(3) }}>
              <YearInput label={t('anchorEditor.from')} value={from} onChange={setFrom} testID="year-from" />
              <YearInput label={t('anchorEditor.to')} value={to} onChange={setTo} testID="year-to" />
            </View>
            <Text style={yearsValid ? font.small : { color: colors.danger }}>
              {yearsValid ? t('anchorEditor.periodHint') : t('anchorEditor.periodError')}
            </Text>
          </View>
        ) : null}

        <View style={{ flex: 1, minHeight: spacing(4) }} />
        <Button testID="save-anchor" label={t('common.save')} disabled={!canSave} loading={busy} onPress={save} />
        {existing ? <Button label={t('anchorEditor.deleteAnchor')} variant="ghost" onPress={remove} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function KindFields({
  kind,
  anchor,
  setCity,
  setSubject,
  setRelation,
}: {
  kind: AnchorKind;
  anchor: Anchor;
  setCity: (c: Picked) => void;
  setSubject: (s: Picked) => void;
  setRelation: (r: AncestorRelation) => void;
}) {
  const optional = t('common.optional');
  const cityField = (label: string) => (
    <Autocomplete testID="city" label={label} placeholder={t('anchorEditor.cityPlaceholder')} items={CITIES} value={anchor.cityLabel} onSelect={setCity} />
  );
  // Suggestions d'écoles / lieux filtrées par ville si elle est connue.
  const schools = useMemo(() => (anchor.cityKey ? SCHOOLS.filter((s) => s.cityKey === anchor.cityKey) : SCHOOLS), [anchor.cityKey]);
  const works = useMemo(() => (anchor.cityKey ? WORKPLACES.filter((s) => s.cityKey === anchor.cityKey) : WORKPLACES), [anchor.cityKey]);

  switch (kind) {
    case 'city':
      return cityField(t('anchorEditor.city'));
    case 'school':
      return (
        <>
          {cityField(t('anchorEditor.city'))}
          <Autocomplete testID="subject" label={t('anchorEditor.school')} placeholder={t('anchorEditor.schoolPlaceholder')} items={schools} value={anchor.subjectLabel} onSelect={setSubject} />
        </>
      );
    case 'work':
      return (
        <>
          {cityField(t('anchorEditor.city'))}
          <Autocomplete testID="subject" label={t('anchorEditor.work')} placeholder={t('anchorEditor.workPlaceholder')} items={works} value={anchor.subjectLabel} onSelect={setSubject} />
        </>
      );
    case 'ancestor_job':
      return (
        <>
          <Text style={styles.label}>{t('anchorEditor.relation')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' }}>
            {(['grandfather', 'grandmother', 'grandparent'] as const).map((r) => (
              <Pressable key={r} onPress={() => setRelation(r)} style={[styles.chip, anchor.relation === r && styles.chipOn]}>
                <Text style={{ color: anchor.relation === r ? colors.bg : colors.text }}>{t(`relations.${r}`)}</Text>
              </Pressable>
            ))}
          </View>
          <Autocomplete testID="subject" label={t('anchorEditor.job')} placeholder={t('anchorEditor.jobPlaceholder')} items={JOBS} value={anchor.subjectLabel} onSelect={setSubject} />
          {cityField(t('anchorEditor.ancestorCity', { optional }))}
        </>
      );
    case 'club':
      return (
        <>
          <Autocomplete testID="subject" label={t('anchorEditor.activity')} placeholder={t('anchorEditor.activityPlaceholder')} items={ACTIVITIES} value={anchor.subjectLabel} onSelect={setSubject} />
          {cityField(t('anchorEditor.city'))}
        </>
      );
    case 'event':
      return (
        <>
          <Autocomplete testID="subject" label={t('anchorEditor.event')} placeholder={t('anchorEditor.eventPlaceholder')} items={EVENTS} value={anchor.subjectLabel} onSelect={setSubject} />
          {cityField(t('anchorEditor.eventCity', { optional }))}
        </>
      );
  }
}

function YearInput({ label, value, onChange, testID }: { label: string; value: string; onChange: (v: string) => void; testID?: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={font.small}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, '').slice(0, 4))}
        placeholder={t('anchorEditor.yearPlaceholder')}
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        maxLength={4}
        style={inputStyle}
      />
    </View>
  );
}

function Header({ title, onClose, color, emoji }: { title: string; onClose: () => void; color?: string; emoji?: string }) {
  return (
    <View style={styles.header}>
      {emoji ? (
        <View style={[styles.headerDot, { backgroundColor: color, shadowColor: color }]}>
          <Text style={{ fontSize: 18 }}>{emoji}</Text>
        </View>
      ) : null}
      <Text style={[font.h2, { flex: 1 }]}>{title}</Text>
      <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')}>
        <Text style={{ color: colors.textMuted, fontSize: 26 }}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), marginBottom: spacing(2) },
  headerDot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.6, shadowRadius: 10 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: { paddingHorizontal: spacing(4), paddingVertical: spacing(2), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
