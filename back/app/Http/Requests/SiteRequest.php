<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SiteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isUpdate = $this->isMethod('PUT') || $this->isMethod('PATCH');
        $site = $this->route('site');
        $siteId = $site instanceof \App\Models\Site ? $site->id : (is_numeric($site) ? (int)$site : null);
        $customerId = $this->input('customer_id');

        return [
            'customer_id'   => ($isUpdate ? 'sometimes' : 'required') . '|integer|exists:customers,id',
            'name'          => [
                ($isUpdate ? 'sometimes' : 'required'),
                'string',
                'max:255',
                \Illuminate\Validation\Rule::unique('sites')->ignore($siteId)->where(function ($query) use ($customerId) {
                    return $query->where('customer_id', $customerId);
                })
            ],
            'address'       => 'nullable|string|max:500',
            'timezone'      => 'nullable|string|max:100',
            'contact_name'  => 'nullable|string|max:255',
            'contact_phone' => 'nullable|string|max:50',
            'lat'           => 'nullable|numeric|between:-90,90',
            'lng'           => 'nullable|numeric|between:-180,180',
        ];
    }

    public function messages(): array
    {
        return [
            'customer_id.required' => 'Le client est obligatoire.',
            'customer_id.exists'   => 'Le client sélectionné n\'existe pas.',
            'name.required'        => 'Le nom du site est obligatoire.',
            'lat.between'          => 'La latitude doit être comprise entre -90 et 90.',
            'lng.between'          => 'La longitude doit être comprise entre -180 et 180.',
        ];
    }
}
