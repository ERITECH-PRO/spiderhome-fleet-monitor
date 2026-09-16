<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'server_address', 'phone', 'email', 'status', 'notes',
        'address', 'city', 'country', 'siret', 'auto_provisioned',
    ];

    protected $casts = [
        'auto_provisioned' => 'boolean',
    ];

    protected $attributes = [
        'server_address' => 'https://cloud.spiderhome.org/',
    ];

    protected static function booted(): void
    {
        static::creating(function ($customer) {
            if (empty($customer->server_address)) {
                $customer->server_address = 'https://cloud.spiderhome.org/';
            }
        });
    }

    /** Statuts valides */
    const STATUSES = ['active', 'inactive', 'prospect', 'suspended'];

    public function sites()
    {
        return $this->hasMany(Site::class);
    }

    public function devices()
    {
        return $this->hasManyThrough(Device::class, Site::class);
    }

    public function serviceRequests()
    {
        return $this->hasMany(ServiceRequest::class);
    }

    /** Compte les sites rattachés */
    public function getSitesCountAttribute(): int
    {
        return $this->sites()->count();
    }

    /** Compte les modules rattachés via les sites */
    public function getDevicesCountAttribute(): int
    {
        return $this->devices()->count();
    }
}
