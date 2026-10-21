import React, { memo, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ApiError, signIn } from '../services/api';
import type { Session } from '../types';
import authLogo from '../../assets/goshen-auth-logo.png';

type LoginStep = 'name' | 'password';

export const LoginScreen = memo(function LoginScreen({ onSignedIn }: { onSignedIn: (session: Session) => void | Promise<void> }) {
  const [step, setStep] = useState<LoginStep>('name');
  const [lastName, setLastName] = useState('');
  const [postName, setPostName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const transitionLock = useRef(false);
  const [stepOpacity] = useState(() => new Animated.Value(1));
  const [stepOffset] = useState(() => new Animated.Value(0));
  const postNameRef = useRef<TextInput>(null);
  const firstNameRef = useRef<TextInput>(null);

  const fullName = useMemo(() => [lastName, postName, firstName].map(value => value.trim()).filter(Boolean).join(' '), [firstName, lastName, postName]);

  const changeStep = async (nextStep: LoginStep) => {
    if (transitionLock.current || nextStep === step) return;
    transitionLock.current = true;
    setTransitioning(true);
    Keyboard.dismiss();
    const direction = nextStep === 'password' ? 1 : -1;
    await new Promise<void>(resolve => Animated.parallel([
      Animated.timing(stepOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(stepOffset, { toValue: -direction * 18, duration: 120, useNativeDriver: true }),
    ]).start(() => resolve()));
    setStep(nextStep);
    stepOpacity.setValue(0);
    stepOffset.setValue(direction * 18);
    await new Promise<void>(resolve => Animated.parallel([
      Animated.timing(stepOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(stepOffset, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => resolve()));
    transitionLock.current = false;
    setTransitioning(false);
  };

  const continueWithName = () => {
    const hasSingleIdentifier = Boolean(lastName.trim()) && !postName.trim() && !firstName.trim();
    const hasCompleteName = Boolean(lastName.trim() && postName.trim() && firstName.trim());
    if (!hasSingleIdentifier && !hasCompleteName) {
      setError('Saisissez votre identifiant dans le premier champ ou complétez les trois champs du nom.');
      return;
    }
    setError('');
    void changeStep('password');
  };

  const submit = async () => {
    if (!password) {
      setError('Saisissez votre mot de passe.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSignedIn(await signIn(fullName, password));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setError('');
    void changeStep('name');
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardArea}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.content}>
            <Animated.View style={{ opacity: stepOpacity, transform: [{ translateX: stepOffset }] }}>
            {step === 'password' ? (
              <Pressable
                accessibilityLabel="Retour à la saisie du nom"
                accessibilityRole="button"
                hitSlop={10}
                onPress={goBack}
                disabled={transitioning}
                style={styles.backButton}
              >
                <Lucide name="arrow-left" size={23} color={COLORS.text} />
              </Pressable>
            ) : null}

            <Image accessibilityLabel="Logo Écho du Ciel · Goshen" alt="Logo Écho du Ciel · Goshen" source={authLogo} style={styles.logo} />
            <Text style={styles.eyebrow}>ÉCHO DU CIEL · GOSHEN</Text>

            {step === 'name' ? (
              <>
                <Text style={styles.title}>Connexion</Text>
                <Text style={styles.subtitle}>Entrez votre nom complet ou votre identifiant pour commencer.</Text>

                <View style={styles.nameForm}>
                  <NameField
                    label="Nom ou identifiant"
                    placeholder="Nom ou identifiant"
                    value={lastName}
                    onChangeText={setLastName}
                    onSubmitEditing={() => postNameRef.current?.focus()}
                    returnKeyType="next"
                  />
                  <NameField
                    ref={postNameRef}
                    label="Postnom"
                    placeholder="Postnom"
                    value={postName}
                    onChangeText={setPostName}
                    onSubmitEditing={() => firstNameRef.current?.focus()}
                    returnKeyType="next"
                  />
                  <NameField
                    ref={firstNameRef}
                    label="Prénom"
                    placeholder="Prénom"
                    value={firstName}
                    onChangeText={setFirstName}
                    onSubmitEditing={continueWithName}
                    returnKeyType="go"
                  />
                  {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
                  <PrimaryButton label="Continuer" onPress={continueWithName} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>Mot de passe</Text>
                <Text style={styles.subtitle}>Saisissez votre mot de passe pour continuer.</Text>

                <Pressable
                  accessibilityLabel={`Nom sélectionné : ${fullName}. Modifier`}
                  accessibilityRole="button"
                  onPress={goBack}
                  style={styles.selectedName}
                >
                  <Lucide name="user-round" size={22} color={COLORS.accent} />
                  <Text numberOfLines={1} style={styles.selectedNameText}>{fullName}</Text>
                  <Text style={styles.modifyText}>Modifier</Text>
                </Pressable>

                <View style={styles.passwordForm}>
                  <Text style={styles.label}>Mot de passe</Text>
                  <View style={styles.inputFrame}>
                    <Lucide name="lock-keyhole" size={21} color={COLORS.muted} />
                    <TextInput
                      accessibilityLabel="Mot de passe"
                      autoCapitalize="none"
                      autoComplete="password"
                      autoCorrect={false}
                      onChangeText={value => { setPassword(value); if (error) setError(''); }}
                      onSubmitEditing={() => void submit()}
                      placeholder="••••••••"
                      placeholderTextColor={COLORS.muted}
                      returnKeyType="go"
                      secureTextEntry={!showPassword}
                      style={styles.inputText}
                      textContentType="password"
                      value={password}
                    />
                    <Pressable
                      accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setShowPassword(value => !value)}
                      style={styles.visibilityButton}
                    >
                      <Lucide name={showPassword ? 'eye-off' : 'eye'} size={22} color={COLORS.muted} />
                    </Pressable>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => Alert.alert('Mot de passe oublié ?', 'Contactez un administrateur Goshen pour réinitialiser le mot de passe de votre compte.')}
                    style={styles.forgotButton}
                  >
                    <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
                  </Pressable>

                  {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
                  <PrimaryButton label="Se connecter" loading={loading || transitioning} onPress={() => void submit()} />
                </View>
              </>
            )}
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
});

type NameFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  onSubmitEditing: () => void;
  returnKeyType: 'next' | 'go';
};

const NameField = React.forwardRef<TextInput, NameFieldProps>(function NameField({ label, placeholder, value, onChangeText, onSubmitEditing, returnKeyType }, ref) {
  return (
    <View style={styles.nameField}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputFrame}>
        <Lucide name="user-round" size={22} color={COLORS.muted} />
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          autoCapitalize="words"
          autoComplete="name"
          autoCorrect={false}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={COLORS.placeholder}
          returnKeyType={returnKeyType}
          style={styles.inputText}
          value={value}
        />
      </View>
    </View>
  );
});

function PrimaryButton({ label, loading = false, onPress }: { label: string; loading?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, loading && styles.primaryButtonDisabled]}
    >
      {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

const COLORS = {
  background: '#0d1410',
  surface: '#19231d',
  border: '#39463e',
  text: '#e7ece8',
  muted: '#a7b2aa',
  placeholder: '#91a097',
  eyebrow: '#91a197',
  accent: '#91dfac',
  button: '#2e814b',
  buttonBorder: '#4b9b66',
  white: '#ffffff',
  error: '#ff8a80',
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  keyboardArea: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: 'stretch' },
  backButton: {
    position: 'absolute', zIndex: 1, top: -8, left: -4, width: 44, height: 44,
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: '#17201b', alignItems: 'center', justifyContent: 'center',
  },
  logo: { width: 96, height: 96, alignSelf: 'center', marginBottom: 14 },
  eyebrow: { color: COLORS.eyebrow, fontSize: 12, lineHeight: 17, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center' },
  title: { color: COLORS.text, fontSize: 36, lineHeight: 43, fontWeight: '700', letterSpacing: -0.8, textAlign: 'center', marginTop: 9 },
  subtitle: { color: COLORS.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  nameForm: { marginTop: 27 },
  nameField: { marginBottom: 13 },
  label: { color: '#c3ccc6', fontSize: 13, lineHeight: 19, fontWeight: '600', marginBottom: 7, marginLeft: 6 },
  inputFrame: {
    height: 52, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22,
    borderRadius: 28, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  inputText: { flex: 1, minWidth: 0, height: '100%', paddingVertical: 0, color: COLORS.text, fontSize: 16 },
  selectedName: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 27,
    paddingHorizontal: 22, borderRadius: 28, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  selectedNameText: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: '500' },
  modifyText: { color: COLORS.accent, fontSize: 14, fontWeight: '600', marginLeft: 4 },
  passwordForm: { marginTop: 12 },
  visibilityButton: { minWidth: 30, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  forgotButton: { alignSelf: 'flex-end', paddingVertical: 12, paddingHorizontal: 4, marginTop: 5 },
  forgotText: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
  primaryButton: {
    height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 4,
    borderRadius: 30, borderWidth: 1, borderColor: COLORS.buttonBorder, backgroundColor: COLORS.button,
  },
  primaryButtonPressed: { opacity: 0.88 },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: COLORS.white, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  error: { color: COLORS.error, fontSize: 13, lineHeight: 18, marginHorizontal: 6, marginBottom: 8 },
});
