import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { errorMessage } from '@/api/client';
import { listTrips } from '@/api/trips';
import { deleteVehicle, listVehicles, type Vehicle } from '@/api/vehicles';
import { PrimaryButton } from '@/components/form/primary-button';
import { ModalDialog } from '@/components/modal-dialog';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VehicleForm } from '@/components/vehicles/vehicle-form';
import { VehicleIcon } from '@/components/vehicles/vehicle-icon';
import { Spacing } from '@/constants/theme';
import {
  fuelTypeLabel,
  vehicleMakeModel,
  vehicleRangeKm,
  VehicleTypeOptions,
} from '@/constants/vehicles';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { pluralize } from '@/utils/dates';
import { formatDistance } from '@/utils/units';

const bannerImage = require('@/assets/images/brand/vehicles-banner.jpg');
const addCardImage = require('@/assets/images/brand/new-vehicle.jpg');

// Banner photo is a 1920 × 548 strip of myvehicle.png; the banner keeps that
// shape, so it is never cropped or stretched.
const BannerAspectRatio = 1920 / 548;

// The add card sits on the banner only when the banner is tall enough to hold
// it (about 300 px); otherwise it goes under the banner.
const MinOverlayWidth = 1050;

// "Add vehicle" stays dark green in both themes.
const AddGreen = '#2F7D3A';

export default function VehiclesScreen() {
  const colors = useTheme();

  // Bumped after every change; the list refetches without flashing empty.
  const [version, setVersion] = useState(0);
  const [state, reload] = useAsync(
    () =>
      Promise.all([listVehicles(), listTrips()]).then(([vehicles, trips]) => ({
        vehicles,
        trips,
      })),
    [version],
  );

  // The popup: add a new vehicle, or edit an existing one. `dialog` keeps
  // its content after closing so the popup can animate out with it.
  const [dialog, setDialog] = useState<
    { mode: 'add' } | { mode: 'edit'; vehicle: Vehicle } | null
  >(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const refresh = () => setVersion((value) => value + 1);
  const openDialog = (next: NonNullable<typeof dialog>) => {
    setDialog(next);
    setDialogOpen(true);
  };
  const openAdd = () => openDialog({ mode: 'add' });

  const data = state.status === 'success' ? state.data : null;

  return (
    <Screen fullWidth>
      <VehiclesBanner onAdd={openAdd} />

      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          My Vehicles
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {data
            ? `${pluralize(data.vehicles.length, 'vehicle', 'vehicles')} · `
            : ''}
          Consumption and tank or battery size are used to plan fuel and
          charging stops and estimate costs.
        </ThemedText>
      </View>

      <ModalDialog
        visible={dialogOpen}
        title={dialog?.mode === 'edit' ? `Edit ${dialog.vehicle.name}` : 'Add a new vehicle'}
        subtitle="Consumption and tank or battery size are used for fuel and charging planning."
        onClose={() => setDialogOpen(false)}>
        {dialog && (
          <VehicleForm
            // Fresh form for each vehicle / new add.
            key={dialog.mode === 'edit' ? dialog.vehicle.id : 'new'}
            vehicle={dialog.mode === 'edit' ? dialog.vehicle : undefined}
            framed={false}
            onSaved={() => {
              setDialogOpen(false);
              refresh();
            }}
          />
        )}
      </ModalDialog>

      {state.status === 'loading' && (
        <View style={styles.status}>
          <ActivityIndicator color={colors.brand} />
          <ThemedText type="small" themeColor="textSecondary">
            Loading your vehicles…
          </ThemedText>
        </View>
      )}

      {state.status === 'error' && (
        <View style={styles.status}>
          <ThemedText themeColor="danger">{state.message}</ThemedText>
          <ThemedText type="linkPrimary" onPress={reload}>
            Try again
          </ThemedText>
        </View>
      )}

      {data && data.vehicles.length === 0 && (
        <ThemedView type="card" style={[styles.empty, { borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.brandSoft }]}>
            <Ionicons name="car-sport-outline" size={40} color={colors.brand} />
          </View>
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No vehicles yet
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            Add the car, van, campervan or motorcycle you travel with.
          </ThemedText>
          <AddButton onPress={openAdd} />
        </ThemedView>
      )}

      {data && data.vehicles.length > 0 && (
        <View style={styles.grid}>
          {data.vehicles.map((vehicle) => (
            <View key={vehicle.id} style={styles.gridItem}>
              <VehicleCard
                vehicle={vehicle}
                tripCount={
                  data.trips.filter((trip) => trip.vehicle_id === vehicle.id)
                    .length
                }
                onEdit={() => openDialog({ mode: 'edit', vehicle })}
                onChanged={refresh}
              />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function VehiclesBanner({ onAdd }: { onAdd: () => void }) {
  const [width, setWidth] = useState(0);
  const overlay = width >= MinOverlayWidth;

  return (
    <View
      style={styles.banner}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ImageBackground
        source={bannerImage}
        resizeMode="cover"
        style={styles.bannerImage}
        imageStyle={styles.bannerPhoto}
        accessibilityIgnoresInvertColors>
        {overlay && (
          <View style={styles.bannerCorner}>
            <AddVehicleCard onAdd={onAdd} />
          </View>
        )}
      </ImageBackground>

      {!overlay && (
        <View style={styles.bannerBelow}>
          <AddVehicleCard onAdd={onAdd} />
        </View>
      )}
    </View>
  );
}

/**
 * Rounded card on a blurred photo, with the "Add vehicle" button.
 */
function AddVehicleCard({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.addCard}>
      <ImageBackground
        source={addCardImage}
        resizeMode="cover"
        blurRadius={8}
        style={styles.addCardImage}
        // Slightly enlarged so the blur doesn't leave soft edges.
        imageStyle={styles.addCardPhoto}
        accessibilityIgnoresInvertColors>
        <View style={styles.addCardShade} />
        <View style={styles.addCardContent}>
          <Text style={styles.addCardTitle}>Add a new vehicle</Text>
          <Text style={styles.addCardText}>
            Save your car, van, campervan or motorcycle to plan fuel and
            charging stops.
          </Text>
          <AddButton onPress={onAdd} />
        </View>
      </ImageBackground>
    </View>
  );
}

function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.addButton,
        { backgroundColor: AddGreen },
        (hovered || pressed) && styles.pressed,
      ]}>
      <Ionicons name="add" size={20} color="#FFFFFF" />
      <ThemedText style={[styles.addButtonText, { color: '#FFFFFF' }]}>
        Add vehicle
      </ThemedText>
    </Pressable>
  );
}

function VehicleCard({
  vehicle,
  tripCount,
  onEdit,
  onChanged,
}: {
  vehicle: Vehicle;
  tripCount: number;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const colors = useTheme();
  const [mode, setMode] = useState<'view' | 'confirmDelete'>('view');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { fuelKm, electricKm } = vehicleRangeKm(vehicle);
  const makeModel = vehicleMakeModel(vehicle);
  const typeLabel =
    VehicleTypeOptions.find((option) => option.value === vehicle.vehicle_type)
      ?.label ?? vehicle.vehicle_type;

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      await deleteVehicle(vehicle.id);
      onChanged();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
      setDeleting(false);
    }
  }

  const specs = [
    vehicle.fuel_consumption !== null && [
      'Consumption',
      `${vehicle.fuel_consumption} L/100 km`,
    ],
    vehicle.tank_capacity !== null && ['Tank', `${vehicle.tank_capacity} L`],
    vehicle.energy_consumption !== null && [
      'Energy use',
      `${vehicle.energy_consumption} kWh/100 km`,
    ],
    vehicle.battery_capacity !== null && [
      'Battery',
      `${vehicle.battery_capacity} kWh`,
    ],
    fuelKm !== null && ['Range', `≈ ${formatDistance(fuelKm * 1000)}`],
    electricKm !== null && [
      fuelKm !== null ? 'Electric range' : 'Range',
      `≈ ${formatDistance(electricKm * 1000)}`,
    ],
  ].filter(Boolean) as [string, string][];

  return (
    <ThemedView type="card" style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: colors.brandSoft }]}>
          <VehicleIcon type={vehicle.vehicle_type} size={44} />
        </View>
        <View style={styles.cardTitle}>
          <ThemedText type="smallBold" style={styles.vehicleName} numberOfLines={1}>
            {vehicle.name}
          </ThemedText>
          {makeModel && (
            <ThemedText type="smallBold" themeColor="textSecondary" numberOfLines={1}>
              {makeModel}
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {typeLabel} · {fuelTypeLabel(vehicle.fuel_type)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.specs}>
        {specs.map(([label, value]) => (
          <View key={label} style={styles.spec}>
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
            <ThemedText type="smallBold">{value}</ThemedText>
          </View>
        ))}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {tripCount > 0
          ? `Used in ${pluralize(tripCount, 'trip', 'trips')}`
          : 'Not used in any trips yet'}
      </ThemedText>

      {mode === 'confirmDelete' ? (
        <View style={[styles.confirm, { borderColor: colors.border }]}>
          <ThemedText type="smallBold">Delete {vehicle.name}?</ThemedText>
          {tripCount > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {pluralize(tripCount, 'trip', 'trips')} will keep their plans
              but no longer have a vehicle.
            </ThemedText>
          )}
          <View style={styles.actions}>
            <View style={styles.actionFill}>
              <PrimaryButton
                label="Delete vehicle"
                danger
                onPress={handleDelete}
                loading={deleting}
              />
            </View>
            <CardButton label="Cancel" onPress={() => setMode('view')} />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <CardButton icon="create-outline" label="Edit" onPress={onEdit} />
          <CardButton
            icon="trash-outline"
            label="Delete"
            danger
            onPress={() => setMode('confirmDelete')}
          />
        </View>
      )}

      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}
    </ThemedView>
  );
}

function CardButton({
  icon,
  label,
  danger = false,
  onPress,
}: {
  icon?: 'create-outline' | 'trash-outline';
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();
  const color = danger ? colors.danger : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.cardButton,
        { borderColor: colors.border },
        (hovered || pressed) && { backgroundColor: colors.backgroundSelected },
      ]}>
      {icon && <Ionicons name={icon} size={18} color={color} />}
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Edge to edge: cancels the page's side padding (see Screen).
  banner: {
    marginHorizontal: -Spacing.four,
  },

  bannerImage: {
    width: '100%',
    aspectRatio: BannerAspectRatio,
    justifyContent: 'flex-end',
    // Clip the photo to the banner so it can't spill past the shading.
    overflow: 'hidden',
  },

  // Exactly the banner's box: same area as the shading on top of it.
  bannerPhoto: {
    width: '100%',
    height: '100%',
  },

  bannerCorner: {
    padding: Spacing.four,
    alignItems: 'flex-start',
  },

  bannerBelow: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },

  addCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
  },

  addCardImage: {
    width: '100%',
  },

  addCardPhoto: {
    transform: [{ scale: 1.15 }],
  },

  addCardShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 12, 20, 0.45)',
  },

  addCardContent: {
    // Above the shade.
    position: 'relative',
    zIndex: 1,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'flex-start',
  },

  addCardTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },

  addCardText: {
    color: '#DCE4EC',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.two,
  },

  header: {
    gap: Spacing.one,
    // Breathing room below the banner (on top of the page's usual gap).
    marginTop: Spacing.four,
  },

  title: {
    fontSize: 40,
    lineHeight: 48,
  },

  addButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
  },

  addButtonText: {
    fontWeight: '700',
  },

  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
    borderRadius: 20,
    borderWidth: 1,
  },

  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    fontSize: 24,
    lineHeight: 32,
  },

  centered: {
    textAlign: 'center',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  gridItem: {
    flexGrow: 1,
    flexBasis: 320,
    maxWidth: '100%',
  },

  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: 18,
    borderWidth: 1,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardTitle: {
    flex: 1,
    minWidth: 0,
  },

  vehicleName: {
    fontSize: 18,
  },

  specs: {
    gap: Spacing.one,
  },

  spec: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },

  confirm: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },

  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },

  actionFill: {
    flex: 1,
  },

  cardButton: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },

  pressed: {
    opacity: 0.85,
  },
});
