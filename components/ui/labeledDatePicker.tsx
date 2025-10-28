// components/ui/labeledDatePicker.tsx
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LabeledDatePickerProps {
  label: string;
  value: Date;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
}

export default function LabeledDatePicker({ label, value, onChange }: LabeledDatePickerProps) {
  const [show, setShow] = useState(false);
  const [dateSet, setDateSet] = useState(false);

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate) {
      onChange(event, selectedDate);
      setDateSet(true);
    }
  };

  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  const yyyy = value.getFullYear();
  const formatted = `${mm}/${dd}/${yyyy}`;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={() => setShow(true)} style={styles.inputContainer}>
        <Text style={dateSet ? styles.dateText : styles.placeholderText}>{dateSet ? formatted : 'mm/dd/yyyy'}</Text>
        <Ionicons name="calendar-outline" size={24} color="#666" />
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
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
  dateText: { fontSize: 16, color: '#000' },
  placeholderText: { fontSize: 16, color: '#999' },
});
