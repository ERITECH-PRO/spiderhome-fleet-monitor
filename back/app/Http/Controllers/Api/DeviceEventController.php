<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceEvent;
use Illuminate\Http\Request;

class DeviceEventController extends Controller
{
    public function index()
    {
        return response()->json(DeviceEvent::with('device')->latest('occurred_at')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'device_id'   => 'required|exists:devices,id',
            'type'        => 'required|string|max:100',
            'severity'    => 'nullable|string|max:50',
            'value'       => 'nullable|string',
            'message'     => 'nullable|string',
            'occurred_at' => 'nullable|date',
        ]);

        $event = DeviceEvent::create($data);
        return response()->json($event, 201);
    }

    public function show(DeviceEvent $deviceEvent)
    {
        return response()->json($deviceEvent->load('device'));
    }

    public function update(Request $request, DeviceEvent $deviceEvent)
    {
        $data = $request->validate([
            'type'        => 'sometimes|string|max:100',
            'severity'    => 'nullable|string|max:50',
            'value'       => 'nullable|string',
            'message'     => 'nullable|string',
            'occurred_at' => 'nullable|date',
        ]);

        $deviceEvent->update($data);
        return response()->json($deviceEvent);
    }

    public function destroy(DeviceEvent $deviceEvent)
    {
        $deviceEvent->delete();
        return response()->json(['message' => 'Événement supprimé.']);
    }
}
