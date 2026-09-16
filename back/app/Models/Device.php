<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Device extends Model
{
    use HasFactory;

    protected $fillable = [
        'site_id', 'model_id', 'guid', 'serial_number', 'legacy_device_key',
        'mac', 'firmware', 'status', 'last_seen_at',
        'label', 'ip_address', 'supla_server',
        'auto_provisioned', 'first_seen_at',
        'last_heap_kb', 'last_frag_pct', 'last_uptime', 'last_status',
        'supla_connected', 'registered_at', 'last_connected_at',
        'wifi_rssi', 'wifi_quality_pct', 'connection_uptime',
    ];

    protected $casts = [
        'last_seen_at'     => 'datetime',
        'first_seen_at'    => 'datetime',
        'auto_provisioned' => 'boolean',
        'last_heap_kb'     => 'float',
        'last_frag_pct'    => 'float',
        'last_uptime'        => 'integer',
        'registered_at'      => 'datetime',
        'last_connected_at'  => 'datetime',
        'supla_connected'    => 'boolean',
        'wifi_rssi'          => 'integer',
        'wifi_quality_pct'   => 'integer',
        'connection_uptime'  => 'integer',
    ];

    /**
     * Le GUID n'est jamais généré côté plateforme : c'est l'identité
     * cryptographique du module, remontée par le module lui-même
     * (panneau Statut de cloud.spiderhome.org / cloud.supla.org).
     */

    /** Statuts valides */
    const STATUSES = ['online', 'offline', 'alert', 'retired'];

    public function site()
    {
        return $this->belongsTo(Site::class);
    }

    public function model()
    {
        return $this->belongsTo(DeviceModel::class, 'model_id');
    }

    public function events()
    {
        return $this->hasMany(DeviceEvent::class);
    }


    /** Raccourci pour accéder au customer via site */
    public function customer()
    {
        return $this->hasOneThrough(Customer::class, Site::class, 'id', 'id', 'site_id', 'customer_id');
    }
}
