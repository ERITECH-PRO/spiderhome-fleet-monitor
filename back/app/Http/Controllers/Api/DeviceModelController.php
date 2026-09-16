<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DeviceModelRequest;
use App\Models\DeviceModel;
use Illuminate\Http\Request;

class DeviceModelController extends Controller
{
    /**
     * GET /api/device-models
     */
    public function index(Request $request)
    {
        $query = DeviceModel::withCount('devices');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('mcu', 'like', "%{$search}%")
                  ->orWhere('manufacturer', 'like', "%{$search}%");
            });
        }

        if ($request->has('ota_capable')) {
            $query->where('ota_capable', $request->boolean('ota_capable'));
        }

        if ($request->boolean('all')) {
            return response()->json($query->orderBy('name')->get());
        }

        $perPage = min((int) $request->get('per_page', 50), 200);
        return response()->json($query->orderBy('name')->paginate($perPage));
    }

    /**
     * POST /api/device-models
     */
    public function store(DeviceModelRequest $request)
    {
        $model = DeviceModel::create($request->validated());
        return response()->json($model->loadCount('devices'), 201);
    }

    /**
     * GET /api/device-models/{deviceModel}
     */
    public function show(DeviceModel $deviceModel)
    {
        return response()->json(
            $deviceModel->load('devices.site.customer')->loadCount('devices')
        );
    }

    /**
     * PUT/PATCH /api/device-models/{deviceModel}
     */
    public function update(DeviceModelRequest $request, DeviceModel $deviceModel)
    {
        $deviceModel->update($request->validated());
        return response()->json($deviceModel->loadCount('devices'));
    }

    /**
     * DELETE /api/device-models/{deviceModel}
     */
    public function destroy(DeviceModel $deviceModel)
    {
        if ($deviceModel->devices()->exists()) {
            return response()->json([
                'message' => 'Impossible de supprimer ce modèle : des modules y sont associés.'
            ], 422);
        }
        $deviceModel->delete();
        return response()->json(['message' => 'Modèle supprimé avec succès.'], 200);
    }
}
