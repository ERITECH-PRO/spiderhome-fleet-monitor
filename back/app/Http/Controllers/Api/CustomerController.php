<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CustomerRequest;
use App\Models\AuditLog;
use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    /**
     * GET /api/customers
     * Liste paginée avec recherche et filtrage.
     */
    public function index(Request $request)
    {
        $query = Customer::withCount(['sites', 'devices']);

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('city', 'like', "%{$search}%");
            });
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        $perPage = (int) $request->get('per_page', 50);
        $perPage = min($perPage, 200);

        if ($request->boolean('all')) {
            return response()->json($query->orderBy('name')->get());
        }

        return response()->json($query->orderBy('name')->paginate($perPage));
    }

    /**
     * POST /api/customers
     */
    public function store(CustomerRequest $request)
    {
        $data = $request->validated();
        if (empty($data['server_address'])) {
            $data['server_address'] = 'https://cloud.spiderhome.org/';
        }
        $customer = Customer::create($data);
        AuditLog::record('customer.created', $customer);
        return response()->json($customer->loadCount(['sites', 'devices']), 201);
    }

    /**
     * GET /api/customers/{customer}
     */
    public function show(Customer $customer)
    {
        return response()->json(
            $customer->load(['sites.devices.model'])->loadCount(['sites', 'devices'])
        );
    }

    /**
     * GET /api/customers/{customer}/export
     * Fiche parc client — cahier §7.1 : « Exporter une fiche parc client
     * sans exposer les secrets techniques. »
     *
     * Volontairement exclus : MAC, legacy_device_key, supla_server, guid —
     * identifiants techniques internes plutôt qu'information client.
     */
    public function export(Customer $customer)
    {
        $customer->load(['sites.devices.model']);

        $filename = 'parc-' . \Illuminate\Support\Str::slug($customer->name) . '-' . now()->format('Y-m-d') . '.csv';

        $columns = [
            'Site', 'Module', 'Modèle', 'MCU', 'Firmware', 'Statut',
            'Installé le', 'Installateur', 'Garantie jusqu\'au', 'Dernière connexion',
        ];

        return response()->streamDownload(function () use ($customer, $columns) {
            $out = fopen('php://output', 'w');
            fputs($out, "\xEF\xBB\xBF"); // BOM UTF-8 : accents lisibles sous Excel
            fputcsv($out, $columns, ';');

            foreach ($customer->sites as $site) {
                foreach ($site->devices as $device) {
                    fputcsv($out, [
                        $site->name,
                        $device->label ?? $device->serial_number,
                        $device->model?->name ?? '—',
                        $device->model?->mcu ?? '—',
                        $device->firmware ?? '—',
                        $device->status,
                        $device->installed_at?->format('d/m/Y') ?? '—',
                        $device->installer_name ?? '—',
                        $device->warranty_until?->format('d/m/Y') ?? '—',
                        $device->last_seen_at?->format('d/m/Y H:i') ?? '—',
                    ], ';');
                }
            }

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * PUT/PATCH /api/customers/{customer}
     */
    public function update(CustomerRequest $request, Customer $customer)
    {
        $data = $request->validated();
        if (array_key_exists('server_address', $data) && empty($data['server_address'])) {
            $data['server_address'] = 'https://cloud.spiderhome.org/';
        }
        $customer->update($data);
        AuditLog::record('customer.updated', $customer, ['fields' => array_keys($data)]);
        return response()->json($customer->loadCount(['sites', 'devices']));
    }

    /**
     * DELETE /api/customers/{customer}
     */
    public function destroy(Customer $customer)
    {
        $sitesCount = $customer->sites()->count();
        if ($sitesCount > 0) {
            return response()->json([
                'message' => "Impossible de supprimer ce client : {$sitesCount} site(s) et les modules associés y sont encore rattachés. Supprimez ou réaffectez d'abord ces sites."
            ], 422);
        }

        AuditLog::record('customer.deleted', $customer, ['name' => $customer->name]);
        $customer->delete();
        return response()->json(['message' => 'Client supprimé avec succès.'], 200);
    }
}
