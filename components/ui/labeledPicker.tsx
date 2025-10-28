// components/ui/labeledPicker.tsx
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React, { useState } from 'react';
import { Button, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LabeledPickerProps {
  label: string;
  selectedValue: string;
  onValueChange: (itemValue: string, itemIndex: number) => void;
  items: { label: string; value: string }[];
  placeholder: string;
}

export default function LabeledPicker({
  label,
  selectedValue,
  onValueChange,
  items,
  placeholder,
}: LabeledPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedLabel = items.find(i => i.value === selectedValue)?.label || placeholder;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity style={styles.inputContainer} onPress={() => setModalVisible(true)}>
        <Text style={selectedValue ? styles.valueText : styles.placeholderText}>{selectedLabel}</Text>
        <Ionicons name="chevron-down-outline" size={24} color="#666" />
      </TouchableOpacity>

      <Modal transparent visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Button title="Done" onPress={() => setModalVisible(false)} />
            </View>
            <Picker
              selectedValue={selectedValue}
              onValueChange={(v, idx) => onValueChange(v.toString(), idx)}
              style={styles.picker}
            >
              <Picker.Item label={placeholder} value="" />
              {items.map(item => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f4f4f4',
    padding: 16,
    borderRadius: 10,
    height: 58,
  },
  valueText: { fontSize: 16, color: '#000' },
  placeholderText: { fontSize: 16, color: '#999' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { alignItems: 'flex-end', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  picker: { width: '100%' },
});
