import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  variant?: 'light' | 'dark';
}

export const ScreenHeader = memo(function ScreenHeader({ title, onBack, variant = 'light' }: ScreenHeaderProps) {
  const dark = variant === 'dark';
  return <View style={[styles.header, dark && styles.darkHeader]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Retour à l’accueil" onPress={onBack} style={[styles.back, dark && styles.darkBack]}>
      <Text style={[styles.backText, dark && styles.darkBackText]}>‹</Text>
    </Pressable>
    <Text style={[styles.title, dark && styles.darkTitle]}>{title}</Text>
  </View>;
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, paddingVertical: 12, backgroundColor: '#f5f8f6' },
  darkHeader: { backgroundColor: '#030712' },
  back: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5ebe6', alignItems: 'center', justifyContent: 'center' },
  darkBack: { backgroundColor: '#1f2937', borderColor: '#374151' },
  backText: { color: '#243128', fontSize: 30, lineHeight: 34 },
  darkBackText: { color: '#d1d5db' },
  title: { marginLeft: 12, color: '#17221b', fontSize: 19, fontWeight: '800' },
  darkTitle: { color: '#fff' },
});
