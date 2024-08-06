import React, { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import app from '../../firebaseConfig';
import { getDatabase, ref, set, onValue, remove } from 'firebase/database';

export function MapboxExample() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef(new Map()); // Store map markers by ID
  const dbRef = useRef(getDatabase(app)); // Memoize Firebase database reference

  // Function to fetch and display markers
  const fetchMarkers = useCallback(async () => {
    try {
      const markersRef = ref(dbRef.current, 'markers');
      onValue(markersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const markerIds = new Set(); // Track marker IDs to remove old markers
          Object.keys(data).forEach(id => {
            markerIds.add(id);
            const marker = data[id];
            if (!markerRefs.current.has(id)) {
              createMarker(id, marker);
            }
          });

          // Remove markers that are no longer in the database
          markerRefs.current.forEach((marker, id) => {
            if (!markerIds.has(id)) {
              marker.remove();
              markerRefs.current.delete(id);
            }
          });
        }
      });
    } catch (error) {
      console.error('Error fetching markers:', error);
    }
  }, []);

  // Function to create a new marker
  const createMarker = useCallback((id, marker) => {
    const mapMarker = new mapboxgl.Marker({ draggable: true })
      .setLngLat([marker.location.lng, marker.location.lat])
      .addTo(mapRef.current);

    markerRefs.current.set(id, mapMarker);

    mapMarker.on('dragend', async (event) => {
      const lngLat = event.target.getLngLat();
      const newLocation = {
        lng: lngLat.lng,
        lat: lngLat.lat
      };

      try {
        await set(ref(dbRef.current, `markers/${id}/location`), newLocation);
        console.log('Marker position updated:', newLocation);
      } catch (error) {
        console.error('Error updating marker position:', error);
      }
    });

    mapMarker.getElement().addEventListener('click', (event) => {
      event.stopPropagation(); // Prevent click from propagating to map
      handleMarkerClick(id);
    });
  }, []);

  // Function to handle marker click
  const handleMarkerClick = async (id) => {
    try {
      await remove(ref(dbRef.current, `markers/${id}`)); // Remove marker from Firebase

      // Fetch markers to update the map
      fetchMarkers();
    } catch (error) {
      console.error('Error removing marker:', error);
    }
  };

  // Function to remove all markers
  const removeAllMarkers = async () => {
    try {
      const markersRef = ref(dbRef.current, 'markers');
      await remove(markersRef); // Remove all markers from Firebase

      // Remove markers from map
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current.clear();

      console.log('All markers removed');
    } catch (error) {
      console.error('Error removing all markers:', error);
    }
  };

  useEffect(() => {
    mapboxgl.accessToken = 'pk.eyJ1IjoieXVyaWlpbXl0a2kiLCJhIjoiY2x6aWYwZ254MGVjcjJpczRseHh0dzZ6YiJ9.RDzVSMXJ-uA-xIFcmVT-7A';

    if (mapRef.current) return; // Initialize map only once

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: [24.0316, 49.8429], // Lviv, Ukraine [lng, lat]
      zoom: 9 // Starting zoom
    });

    // Fetch markers initially
    fetchMarkers();

    // Add click event to add new markers
    mapRef.current.on('click', async (e) => {
      // Ignore click if it is on an existing marker
      if (e.originalEvent.defaultPrevented) return;

      const markerId = uuidv4(); // Generate a unique ID
      const markerDetails = {
        id: markerId, // Add ID to marker details
        location: {
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
        },
        timestamp: new Date().toISOString()
      };

      try {
        // Add marker to Firebase
        await set(ref(dbRef.current, `markers/${markerId}`), markerDetails);

        // Fetch markers to update the map
        fetchMarkers();

        console.log('Marker added:', markerDetails);
      } catch (error) {
        console.error('Error adding marker:', error);
      }
    });
  }, [fetchMarkers]); // Dependency array includes fetchMarkers

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'absolute' }}>
      <div
        style={{ width: '100%', height: '100%', position: 'absolute' }}
        ref={mapContainerRef}
        className="map-container"
      />
      <button
        onClick={removeAllMarkers}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          padding: '10px',
          backgroundColor: '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Remove All Markers
      </button>
    </div>
  );
}
