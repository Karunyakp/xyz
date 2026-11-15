import { useState } from 'react';
import { format } from 'date-fns';
import type { DataRow } from '../domain/models';
import { Card, StatusBadge } from './ui';
export function VenueAvailability({
  venues,
  bookings,
}: {
  venues: DataRow[];
  bookings: DataRow[];
}) {
  const [venue, setVenue] = useState(venues[0]?.id || ''),
    [day, setDay] = useState(format(new Date(), 'yyyy-MM-dd'));
  const current = venues.find((v) => v.id === venue);
  return (
    <Card>
      <h2>Venue availability calendar</h2>
      <div className="filter-grid">
        <label>
          Venue
          <select value={venue} onChange={(e) => setVenue(e.target.value)}>
            <option value="">Select a venue</option>
            {venues.map((v) => (
              <option value={v.id} key={v.id}>
                {String(v.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
      </div>
      {venue && day && (
        <div className="availability-slots">
          {Array.from({ length: 24 }, (_, hour) => {
            const start = new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`),
              end = new Date(start.getTime() + 3600000);
            const booking = bookings.find(
              (b) =>
                b.venue_id === venue &&
                b.status === 'confirmed' &&
                new Date(String(b.starts_at)) < end &&
                new Date(String(b.ends_at)) > start,
            );
            const busy = Boolean(booking || current?.maintenance);
            return (
              <div className={'availability-slot ' + (busy ? 'busy' : '')} key={hour}>
                <strong>{String(hour).padStart(2, '0')}:00</strong>
                <StatusBadge
                  value={current?.maintenance ? 'maintenance' : busy ? 'reserved' : 'available'}
                />
              </div>
            );
          })}
        </div>
      )}
      <p className="muted">
        Hourly view in your device timezone. Any overlap marks the hour reserved. Final approval
        checks the exact start and end times transactionally; this view is not a reservation.
      </p>
    </Card>
  );
}
