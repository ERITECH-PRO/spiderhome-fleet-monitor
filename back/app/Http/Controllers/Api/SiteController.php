<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SiteRequest;
use App\Models\Site;
use Illuminate\Http\Request;

class SiteController extends Controller
{
    /**
     * GET /api/sites
     * Liste avec filtres par customer et recherche.
     */
    public function index(Request $request)
    {
        $query = Site::with('customer')->withCount('devices');

        if ($customerId = $request->get('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('address', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->boolean('all')) {
            return response()->json($query->orderBy('name')->get());
        }

        $perPage = min((int) $request->get('per_page', 50), 200);
        return response()->json($query->orderBy('name')->paginate($perPage));
    }

    /**
     * POST /api/sites
     */
    public function store(SiteRequest $request)
    {
        $site = Site::create($request->validated());
        return response()->json($site->load('customer')->loadCount('devices'), 201);
    }

    /**
     * GET /api/sites/{site}
     */
    public function show(Site $site)
    {
        return response()->json(
            $site->load(['customer', 'devices.model'])->loadCount('devices')
        );
    }

    /**
     * PUT/PATCH /api/sites/{site}
     */
    public function update(SiteRequest $request, Site $site)
    {
        $site->update($request->validated());
        return response()->json($site->load('customer')->loadCount('devices'));
    }

    /**
     * DELETE /api/sites/{site}
     */
    public function destroy(Site $site)
    {
        $devicesCount = $site->devices()->count();
        if ($devicesCount > 0) {
            return response()->json([
                'message' => "Impossible de supprimer ce site : {$devicesCount} module(s) IoT y sont encore installés. Réaffectez ou retirez d'abord ces modules."
            ], 422);
        }

        $site->delete();
        return response()->json(['message' => 'Site supprimé avec succès.'], 200);
    }
}
