<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DeviceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isUpdate  = $this->isMethod('PUT') || $this->isMethod('PATCH');
        $rawDevice = $this->route('device');
        $deviceId  = is_object($rawDevice) ? ($rawDevice->id ?? null) : $rawDevice;

        return [
            'site_id'            => ($isUpdate ? 'sometimes' : 'required') . '|integer|exists:sites,id',
            'model_id'           => ($isUpdate ? 'sometimes' : 'required') . '|integer|exists:device_models,id',
            'guid'               => 'nullable|string|max:64|unique:devices,guid,' . $deviceId,
            'serial_number'      => ($isUpdate ? 'sometimes' : 'required') . '|string|max:100|unique:devices,serial_number,' . $deviceId,
            'legacy_device_key'  => 'nullable|string|max:100|unique:devices,legacy_device_key,' . $deviceId,
            'mac'                => 'nullable|string|max:17',
            'firmware'           => 'nullable|string|max:50',
            'status'             => 'nullable|string|in:online,offline,alert,retired',
            'label'              => 'nullable|string|max:255',
            'ip_address'         => 'nullable|string|max:45',
            'supla_server'       => 'nullable|string|max:255',
        ];
    }

    public function messages(): array
    {
        return [
            'site_id.required'           => 'Le site est obligatoire.',
            'site_id.exists'             => 'Le site sélectionné n\'existe pas.',
            'model_id.required'          => 'Le modèle est obligatoire.',
            'model_id.exists'            => 'Le modèle sélectionné n\'existe pas.',
            'serial_number.required'     => 'Le numéro de série est obligatoire.',
            'serial_number.unique'       => 'Ce numéro de série est déjà utilisé.',
            'legacy_device_key.unique'   => 'Cette clé legacy est déjà utilisée par un autre module.',
            'status.in'                  => 'Le statut doit être : online, offline, alert ou retired.',
        ];
    }
}
